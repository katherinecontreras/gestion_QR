import { supabase } from '../supabaseClient.js'

export const TIPOS = {
  HORMIGONES: 'hormigones',
  CANERIAS: 'canerias',
}

export function buildQrPayload({ id, tipo }) {
  const fromEnv = import.meta?.env?.VITE_PUBLIC_APP_URL
  const fallback = 'https://gestion-qr.vercel.app'
  const runtime = typeof window !== 'undefined' ? window.location.origin : ''
  const base = String(fromEnv || fallback || runtime || '').trim()
  const origin = base.replace(/\/+$/, '')
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
    function normalizeStr(v) {
      const s = String(v ?? '').trim()
      return s ? s : null
    }

    function normalizeNroInterno(r) {
      return normalizeStr(
        r.nro_interno ??
          r.NRO_INTERNO ??
          r.Nro_Interno ??
          r['nro interno'] ??
          r['Nro Interno'],
      )
    }

    function normalizePeso(v) {
      if (v == null || v === '') return null
      if (typeof v === 'number' && Number.isFinite(v)) return v
      const s = String(v).trim()
      if (!s) return null
      const n = Number.parseFloat(s.replace(',', '.'))
      return Number.isFinite(n) ? n : null
    }

    // Deduplicamos por nro_interno (si el Excel trae repetidos)
    const byNro = new Map()
    for (const r of rows) {
      const nro = normalizeNroInterno(r)
      if (!nro) continue

      const titulo = normalizeStr(r.titulo ?? r.TITULO ?? r.Titulo)
      const satelite = normalizeStr(r.satelite ?? r.SATELITE ?? r.Satelite)
      const peso = normalizePeso(
        r.peso_total_base_kg ?? r.PESO_TOTAL_BASE_KG ?? r.Peso_Total_Base_Kg,
      )

      const item = { nro_interno: nro }
      // Importante: si no viene un campo, NO lo mandamos para no pisar con null/vacío.
      if (titulo != null) item.titulo = titulo
      if (satelite != null) item.satelite = satelite
      if (peso != null) item.peso_total_base_kg = peso

      byNro.set(nro, item)
    }

    const payload = Array.from(byNro.values())
    if (payload.length === 0) return { inserted: 0, updated: 0 }

    // Calculamos cuántos ya existían (para feedback al usuario)
    const nroList = payload.map((p) => p.nro_interno).filter(Boolean)
    const { data: existing, error: eExisting } = await supabase
      .from(TIPOS.HORMIGONES)
      .select('nro_interno')
      .in('nro_interno', nroList)
    if (eExisting) throw eExisting
    const existingCount = existing?.length ?? 0

    const { data, error } = await supabase
      .from(TIPOS.HORMIGONES)
      .upsert(payload, { onConflict: 'nro_interno' })
      .select('id_hormigon')

    if (error) throw error
    const total = data?.length ?? payload.length
    const updated = existingCount
    const inserted = Math.max(0, total - existingCount)
    return { inserted, updated, total }
  }

  const payload = rows
    .map((r) => {
      const satelite = r.satelite ?? r.SATELITE ?? r.Satelite ?? null
      const nro_linea_raw =
        r.nro_linea ?? r.NRO_LINEA ?? r.Nro_Linea ?? r['nro linea'] ?? r['Nro Línea'] ?? null
      const nro_iso_raw =
        r.nro_iso ?? r.NRO_ISO ?? r.Nro_Iso ?? r['nro iso'] ?? r['Nro Iso'] ?? null
      const cantidad_raw = r.cantidad ?? r.CANTIDAD ?? r.Cantidad ?? 1

      const nro_linea = String(nro_linea_raw ?? '').trim()
      const nro_iso = String(nro_iso_raw ?? '').trim()
      const cantidad =
        typeof cantidad_raw === 'number' && Number.isFinite(cantidad_raw)
          ? Math.max(1, Math.trunc(cantidad_raw))
          : Math.max(1, Math.trunc(Number.parseInt(String(cantidad_raw ?? '1'), 10) || 1))

      return {
        satelite: satelite == null || satelite === '' ? null : String(satelite).trim(),
        nro_linea: nro_linea || null,
        nro_iso,
        cantidad,
      }
    })
    .filter((r) => r.nro_iso)

  if (payload.length === 0) return { inserted: 0, updated: 0 }

  // Deduplicamos por clave compuesta: (nro_iso, nro_linea, satelite).
  // Importante: si cambia el satélite, es OTRO dato.
  const byKey = new Map()
  for (const r of payload) {
    const iso = String(r.nro_iso ?? '').trim()
    const linea = r.nro_linea == null ? '' : String(r.nro_linea).trim()
    const sat = r.satelite == null ? '' : String(r.satelite).trim()
    if (!iso || !sat) continue

    const key = `${iso}||${linea}||${sat}`
    const prev = byKey.get(key)
    if (prev) {
      prev.cantidad += r.cantidad ?? 1
    } else {
      byKey.set(key, {
        nro_iso: iso,
        nro_linea: linea || null,
        satelite: sat,
        cantidad: r.cantidad ?? 1,
      })
    }
  }

  const mergedPayload = Array.from(byKey.values())
  if (mergedPayload.length === 0) return { inserted: 0, updated: 0 }

  const nroIsoList = Array.from(new Set(mergedPayload.map((p) => p.nro_iso).filter(Boolean)))
  const { data: existing, error: eExisting } = await supabase
    .from(TIPOS.CANERIAS)
    .select('nro_iso,nro_linea,satelite')
    .in('nro_iso', nroIsoList)
  if (eExisting) throw eExisting
  const existingSet = new Set(
    (existing ?? []).map((r) => `${r.nro_iso}||${String(r.nro_linea ?? '')}||${String(r.satelite ?? '')}`),
  )
  const existingCount = mergedPayload.reduce((acc, r) => {
    const k = `${r.nro_iso}||${String(r.nro_linea ?? '')}||${String(r.satelite ?? '')}`
    return acc + (existingSet.has(k) ? 1 : 0)
  }, 0)
  // Regla: `cantidad` representa repeticiones del Excel (no se acumula con lo ya cargado).
  for (const r of mergedPayload) {
    r.cantidad = Math.max(1, r.cantidad ?? 1)
  }

  const { data, error } = await supabase
    .from(TIPOS.CANERIAS)
    .upsert(mergedPayload, { onConflict: 'nro_iso,nro_linea,satelite' })
    .select('id_caneria')

  if (error) throw error
  const total = data?.length ?? mergedPayload.length
  const updated = existingCount
  const inserted = Math.max(0, total - existingCount)
  return { inserted, updated, total }
}

