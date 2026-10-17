'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { isValidISO, todayISO } from '@/lib/dates'
import { parseTimeToCs } from '@/lib/time'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DISCIPLINES = ['100m', '200m', 'otra']
const IMPORTANCES = ['A', 'B', 'C']

function back(kind: 'error' | 'message', text: string): never {
  redirect(`/competencias?${kind}=${encodeURIComponent(text)}`)
}

function refresh() {
  revalidatePath('/competencias')
  revalidatePath('/calendario')
}

// Numero decimal ("1,5" o "1.5"); vacio -> null; invalido -> NaN
function decimalOrNull(value: FormDataEntryValue | null): number | null {
  const s = String(value ?? '').trim().replace(',', '.')
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : NaN
}

export async function createCompetition(formData: FormData) {
  const supabase = await createClient()

  const name = String(formData.get('name') ?? '').trim().slice(0, 80)
  const date = String(formData.get('date') ?? '')
  const discipline = String(formData.get('discipline') ?? '')
  const importance = String(formData.get('importance') ?? '')
  const goalRaw = String(formData.get('goal') ?? '').trim()
  const notes = String(formData.get('notes') ?? '').trim() || null

  if (!name) back('error', 'Poné el nombre de la competencia.')
  if (!isValidISO(date)) back('error', 'La fecha no es válida.')
  if (!DISCIPLINES.includes(discipline)) back('error', 'Elegí la prueba.')
  if (!IMPORTANCES.includes(importance)) back('error', 'Elegí la importancia.')

  let goalCs: number | null = null
  if (goalRaw) {
    goalCs = parseTimeToCs(goalRaw)
    if (goalCs === null) back('error', 'El tiempo objetivo no es válido (ej: 10.85 o 22.40).')
  }

  // user_id se completa solo con el usuario logueado (default auth.uid())
  const { error } = await supabase.from('competitions').insert({
    event_date: date,
    name,
    discipline,
    importance,
    goal_time_cs: goalCs,
    notes,
  })

  if (error) back('error', 'No se pudo guardar la competencia.')

  refresh()
  back('message', 'Competencia guardada.')
}

export async function saveResult(formData: FormData) {
  const supabase = await createClient()

  const id = String(formData.get('id') ?? '')
  if (!UUID.test(id)) back('error', 'Competencia no encontrada.')

  const resultCs = parseTimeToCs(String(formData.get('result') ?? ''))
  const wind = decimalOrNull(formData.get('wind'))

  if (resultCs === null) back('error', 'El tiempo no es válido (ej: 10.85 o 22.40).')
  if (wind !== null && (Number.isNaN(wind) || wind < -10 || wind > 10)) {
    back('error', 'El viento tiene que estar entre -10 y 10 m/s.')
  }

  // RLS: solo encuentra competencias propias
  const { data: comp } = await supabase
    .from('competitions')
    .select('id, event_date')
    .eq('id', id)
    .maybeSingle()

  if (!comp) back('error', 'Competencia no encontrada.')
  if (comp!.event_date > todayISO()) {
    back('error', 'Todavía no se corrió: el resultado se carga desde el día de la competencia.')
  }

  const { error } = await supabase
    .from('competitions')
    .update({
      result_time_cs: resultCs,
      wind_ms: wind === null ? null : Math.round(wind * 10) / 10,
    })
    .eq('id', id)

  if (error) back('error', 'No se pudo guardar el resultado.')

  refresh()
  back('message', 'Resultado guardado.')
}

export async function deleteCompetition(formData: FormData) {
  const supabase = await createClient()

  const id = String(formData.get('id') ?? '')
  if (!UUID.test(id)) back('error', 'Competencia no encontrada.')

  const { error } = await supabase.from('competitions').delete().eq('id', id)
  if (error) back('error', 'No se pudo eliminar la competencia.')

  refresh()
  back('message', 'Competencia eliminada.')
}