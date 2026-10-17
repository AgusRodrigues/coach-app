'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { isValidISO, todayISO } from '@/lib/dates'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PAIN_TYPES = ['tiron', 'agudo', 'carga_muscular', 'articular', 'otro']

function intIn(value: FormDataEntryValue | null, min: number, max: number): number | null {
  const s = String(value ?? '').trim()
  if (!/^\d+$/.test(s)) return null
  const n = parseInt(s, 10)
  return n >= min && n <= max ? n : null
}

function back(kind: 'error' | 'message', text: string): never {
  redirect(`/molestias?${kind}=${encodeURIComponent(text)}`)
}

function refresh() {
  revalidatePath('/molestias')
  revalidatePath('/')
}

const SEEK_HELP =
  ' Si es aguda, empeora o dura más de unos días, conviene que la evalúe un profesional.'

export async function createPain(formData: FormData) {
  const supabase = await createClient()

  const zone = String(formData.get('zone') ?? '')
  const type = String(formData.get('type') ?? '')
  const intensity = intIn(formData.get('intensity'), 0, 10)
  const date = String(formData.get('date') ?? '')
  const notes = String(formData.get('notes') ?? '').trim() || null

  if (!zone) back('error', 'Elegí la zona del cuerpo.')
  if (!PAIN_TYPES.includes(type)) back('error', 'Elegí el tipo de molestia.')
  if (intensity === null) back('error', 'La intensidad tiene que ser de 0 a 10.')
  if (!isValidISO(date) || date > todayISO()) {
    back('error', 'La fecha no es válida (no puede ser futura).')
  }

  // user_id se completa solo con el usuario logueado (default auth.uid())
  const { error } = await supabase.from('pain_reports').insert({
    zone_code: zone,
    pain_type: type,
    intensity,
    reported_on: date,
    notes,
  })

  if (error) back('error', 'No se pudo guardar la molestia.')

  refresh()
  const warn = type === 'agudo' || (intensity ?? 0) >= 6
  back('message', warn ? 'Molestia registrada.' + SEEK_HELP : 'Molestia registrada.')
}

export async function resolvePain(formData: FormData) {
  const supabase = await createClient()

  const id = String(formData.get('id') ?? '')
  if (!UUID.test(id)) back('error', 'Molestia no encontrada.')

  // RLS: solo se pueden modificar molestias propias
  const { error } = await supabase
    .from('pain_reports')
    .update({ resolved_on: todayISO() })
    .eq('id', id)
    .is('resolved_on', null)

  if (error) back('error', 'No se pudo marcar como resuelta.')

  refresh()
  back('message', 'Marcada como resuelta.')
}

export async function updatePain(formData: FormData) {
  const supabase = await createClient()

  const id = String(formData.get('id') ?? '')
  const intensity = intIn(formData.get('intensity'), 0, 10)

  if (!UUID.test(id)) back('error', 'Molestia no encontrada.')
  if (intensity === null) back('error', 'La intensidad tiene que ser de 0 a 10.')

  const { error } = await supabase
    .from('pain_reports')
    .update({ intensity })
    .eq('id', id)

  if (error) back('error', 'No se pudo actualizar la intensidad.')

  refresh()
  back('message', 'Intensidad actualizada.')
}

export async function deletePain(formData: FormData) {
  const supabase = await createClient()

  const id = String(formData.get('id') ?? '')
  if (!UUID.test(id)) back('error', 'Molestia no encontrada.')

  const { error } = await supabase.from('pain_reports').delete().eq('id', id)
  if (error) back('error', 'No se pudo eliminar la molestia.')

  refresh()
  back('message', 'Molestia eliminada.')
}