import { supabase } from '../supabaseClient.js'

export async function adminCreateUser({ email, password, roleId }) {
  const { data } = await supabase.auth.getSession()
  const token = data?.session?.access_token
  if (!token) throw new Error('Sesión inválida')

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ email, password, roleId }),
  })

  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    // no-op
  }

  if (!res.ok) {
    throw new Error(json?.error ?? text ?? 'No se pudo crear el usuario')
  }

  return json ?? { ok: true }
}

