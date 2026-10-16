'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { addDays, isValidISO, isValidTime, mondayOf, toTimestamp } from '@/lib/dates'

const KINDS = ['track', 'gym', 'daily_life', 'competition', 'other'] as const

function back(week: string | null, kind: 'error' | 'message', text: string): never {
  const params = new URLSearchParams()
  if (week) params.set('semana', week)
  params.set(kind, text)
  redirect(`/calendario?${params.toString()}`)
}

export async function createEvent(formData: FormData) {
  const supabase = await createClient()

  const title = String(formData.get('title') ?? '').trim()
  const kind = String(formData.get('kind') ?? '')
  const date = String(formData.get('date') ?? '')
  const start = String(formData.get('start') ?? '')
  const end = String(formData.get('end') ?? '')
  const notes = String(formData.get('notes') ?? '').trim() || null
  const planned = formData.get('planned') === 'on'
  const repeat = Math.min(
    Math.max(parseInt(String(formData.get('repeat') ?? '1'), 10) || 1, 1),
    26
  )

  const week = isValidISO(date) ? mondayOf(date) : null

  if (!title) back(week, 'error', 'Poné un título.')
  if (!(KINDS as readonly string[]).includes(kind)) {
    back(week, 'error', 'Elegí un tipo de evento.')
  }
  if (!isValidISO(date) || !isValidTime(start) || !isValidTime(end)) {
    back(week, 'error', 'Revisá la fecha y las horas.')
  }
  if (end <= start) {
    back(week, 'error', 'La hora de fin tiene que ser posterior a la de inicio.')
  }

  // Un evento por semana, con el mismo dia y horario
  const rows = Array.from({ length: repeat }, (_, i) => {
    const d = addDays(date, 7 * i)
    return {
      kind,
      title,
      starts_at: toTimestamp(d, start),
      ends_at: toTimestamp(d, end),
      is_planned_training: planned,
      notes,
    }
  })

  const { error } = await supabase.from('calendar_events').insert(rows)
  if (error) back(week, 'error', 'No se pudo guardar el evento.')

  revalidatePath('/calendario')
  back(week, 'message', repeat > 1 ? `Se crearon ${repeat} eventos.` : 'Evento creado.')
}

export async function deleteEvent(formData: FormData) {
  const supabase = await createClient()

  const id = String(formData.get('id') ?? '')
  const rawWeek = String(formData.get('semana') ?? '')
  const week = isValidISO(rawWeek) ? rawWeek : null

  // RLS garantiza que solo se pueden borrar eventos propios
  const { error } = await supabase.from('calendar_events').delete().eq('id', id)
  if (error) back(week, 'error', 'No se pudo borrar el evento.')

  revalidatePath('/calendario')
  back(week, 'message', 'Evento borrado.')
}