import { supabase } from '../supabaseClient.js'

async function fetchProfileWithJoin(userId) {
  // Intenta traer el rol vía relación (perfiles -> roles)
  const { data, error } = await supabase
    .from('perfiles')
    .select('id_rol, email, roles(*)')
    .eq('id_usuario', userId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const roleName = data.roles?.nombre ?? data.roles?.name ?? null
  return { ...data, roleName }
}

async function fetchProfileFallback(userId) {
  const { data: perfil, error: e1 } = await supabase
    .from('perfiles')
    .select('id_rol, email')
    .eq('id_usuario', userId)
    .maybeSingle()

  if (e1) throw e1
  if (!perfil) return null

  const { data: rol, error: e2 } = await supabase
    .from('roles')
    .select('*')
    .eq('id_rol', perfil.id_rol)
    .maybeSingle()

  if (e2) throw e2
  return { ...perfil, roleName: rol?.nombre ?? rol?.name ?? null }
}

export async function fetchUserProfile(userId) {
  try {
    return await fetchProfileWithJoin(userId)
  } catch {
    return await fetchProfileFallback(userId)
  }
}

