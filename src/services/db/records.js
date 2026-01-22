import { supabase } from '../supabaseClient.js'

export const TIPOS = {
  HORMIGONES: 'hormigones',
  CANERIAS: 'canerias',
}

export function buildQrPayload({ id, tipo }) {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const t = tipo === TIPOS.CANERIAS ? TIPOS.CANERIAS : TIPOS.HORMIGONES
  return `${origin}/detalle/${id}?t=${encodeURIComponent(t)}`
}

export async function getRecordById({ id, tipo }) {
  if (tipo) {
    const { data, error } = await supabase.from(tipo).select('*').eq(`id_${tipo === TIPOS.CANERIAS ? 'caneria' : 'hormigon'}`, id).maybeSingle()
    if (error) throw error
    return data ? { tipo, data } : null
  }

  // fallback: prueba ambas tablas (útil si el QR solo trae el UUID)
  {
    const { data, error } = await supabase.from(TIPOS.HORMIGONES).select('*').eq('id_hormigon', id).maybeSingle()
    if (error) throw error
    if (data) return { tipo: TIPOS.HORMIGONES, data }
  }
  {
    const { data, error } = await supabase.from(TIPOS.CANERIAS).select('*').eq('id_caneria', id).maybeSingle()
    if (error) throw error
    if (data) return { tipo: TIPOS.CANERIAS, data }
  }
  return null
}

export async function searchHormigones({ titulo, nroInterno, limit = 20 }) {
  let q = supabase.from(TIPOS.HORMIGONES).select('*').order('titulo', { ascending: true }).limit(limit)
  if (titulo) q = q.ilike('titulo', `%${titulo}%`)
  if (nroInterno) q = q.ilike('nro_interno', `%${nroInterno}%`)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function searchCanerias({ nroLinea, nroIso, limit = 20 }) {
  let q = supabase.from(TIPOS.CANERIAS).select('*').order('nro_iso', { ascending: true }).limit(limit)
  if (nroLinea) q = q.ilike('nro_linea', `%${nroLinea}%`)
  if (nroIso) q = q.ilike('nro_iso', `%${nroIso}%`)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function saveQrPayload({ tipo, id, qrPayload }) {
  const pk = tipo === TIPOS.CANERIAS ? 'id_caneria' : 'id_hormigon'
  const { error } = await supabase.from(tipo).update({ qr_code_url: qrPayload }).eq(pk, id)
  if (error) throw error
}

export async function saveArchivoUrl({ tipo, id, archivoUrl }) {
  const pk = tipo === TIPOS.CANERIAS ? 'id_caneria' : 'id_hormigon'
  const { error } = await supabase.from(tipo).update({ archivo_url: archivoUrl }).eq(pk, id)
  if (error) throw error
}

export async function upsertFromExcel({ tipo, rows }) {
  if (!Array.isArray(rows) || rows.length === 0) return { inserted: 0 }

  if (tipo === TIPOS.HORMIGONES) {
    const payload = rows.map((r) => ({
      titulo: r.titulo ?? r.TITULO ?? r.Titulo ?? '',
      nro_interno: String(r.nro_interno ?? r.NRO_INTERNO ?? r.Nro_Interno ?? r['nro interno'] ?? r['Nro Interno'] ?? '').trim(),
      peso_total_base_kg: r.peso_total_base_kg ?? r.PESO_TOTAL_BASE_KG ?? r.Peso_Total_Base_Kg ?? null,
      satelite: r.satelite ?? r.SATELITE ?? r.Satelite ?? null,
    })).filter((r) => r.titulo && r.nro_interno)

    const { data, error } = await supabase
      .from(TIPOS.HORMIGONES)
      .upsert(payload, { onConflict: 'nro_interno' })
      .select('id_hormigon')

    if (error) throw error
    return { inserted: data?.length ?? 0 }
  }

  const payload = rows
    .map((r) => ({
      satelite: r.satelite ?? r.SATELITE ?? r.Satelite ?? null,
      nro_linea: String(r.nro_linea ?? r.NRO_LINEA ?? r.Nro_Linea ?? r['nro linea'] ?? r['Nro Línea'] ?? '').trim(),
      nro_iso: String(r.nro_iso ?? r.NRO_ISO ?? r.Nro_Iso ?? r['nro iso'] ?? r['Nro Iso'] ?? '').trim(),
    }))
    .filter((r) => r.nro_linea && r.nro_iso)

  const { data, error } = await supabase
    .from(TIPOS.CANERIAS)
    .upsert(payload, { onConflict: 'nro_iso' })
    .select('id_caneria')

  if (error) throw error
  return { inserted: data?.length ?? 0 }
}

