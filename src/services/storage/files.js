import { supabase } from '../supabaseClient.js'
import { TIPOS } from '../db/records.js'

const BUCKET = import.meta.env.VITE_SUPABASE_BUCKET ?? 'documentos'

export async function uploadArchivo({ tipo, id, file }) {
  if (!file) throw new Error('Archivo inválido')
  const folder = tipo === TIPOS.CANERIAS ? 'canerias' : 'hormigones'
  const path = `${folder}/${id}/${Date.now()}-${file.name}`

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: false,
    cacheControl: '3600',
  })
  if (upErr) throw upErr

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  const publicUrl = data?.publicUrl ?? null

  // Si el bucket no es público, devolvemos el path para que el backend/cliente genere signed URL.
  return { bucket: BUCKET, path, publicUrl }
}

export async function createSignedUrl({ path, expiresIn = 60 * 30 }) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn)
  if (error) throw error
  return data?.signedUrl ?? null
}

