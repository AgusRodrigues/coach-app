'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { addDays, isValidISO, isValidTime, toTimestamp } from '@/lib/dates'

const KINDS = ['track', 'gym', 'daily_life', 'competition', 'other'] as const

// Solo se acepta volver a una ruta del calendario (evita redirecciones a otros sitios)
function safeReturn(raw: FormDataEntryValue | null): string {
  const s = String(raw ?? '')
  return s === '/calendario' || s.startsWith('/calendario?') ? s : '/calendario'
}

// Vuelve a la misma vista (semana o mes) agregando el mensaje o el error
function back(returnTo: string, kind: 'error' | 'message', text: string): never {
  const url = new URL(returnTo, 'http://local')
  url.searchParams.delete('error')
  url.searchParams.delete('message')
  url.searchParams.set(kind, text)
  redirect(url.pathname + url.search)
}

export async function createEvent(formData: FormData) {
  const supabase = await createClient()
  const returnTo = safeReturn(formData.get('return_to'))

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

  if (!title) back(returnTo, 'error', 'Poné un título.')
  if (!(KINDS as readonly string[]).includes(kind)) {
    back(returnTo, 'error', 'Elegí un tipo de evento.')
  }
  if (!isValidISO(date) || !isValidTime(start) || !isValidTime(end)) {
    back(returnTo, 'error', 'Revisá la fecha y las horas.')
  }
  if (end <= start) {
    back(returnTo, 'error', 'La hora de fin tiene que ser posterior a la de inicio.')
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
  if (error) back(returnTo, 'error', 'No se pudo guardar el evento.')

  revalidatePath('/calendario')
  revalidatePath('/')
  back(returnTo, 'message', repeat > 1 ? `Se crearon ${repeat} eventos.` : 'Evento creado.')
}

export async function deleteEvent(formData: FormData) {
  const supabase = await createClient()
  const returnTo = safeReturn(formData.get('return_to'))

  const id = String(formData.get('id') ?? '')

  // RLS garantiza que solo se pueden borrar eventos propios
  const { error } = await supabase.from('calendar_events').delete().eq('id', id)
  if (error) back(returnTo, 'error', 'No se pudo borrar el evento.')

  revalidatePath('/calendario')
  revalidatePath('/')
  back(returnTo, 'message', 'Evento borrado.')
}
