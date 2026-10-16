'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { isoDateInTZ, mondayOf } from '@/lib/dates'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PAIN_TYPES = ['tiron', 'agudo', 'carga_muscular', 'articular', 'otro']

// Entero dentro de un rango; si no es valido, devuelve null
function intIn(value: FormDataEntryValue | null, min: number, max: number): number | null {
  const s = String(value ?? '').trim()
  if (!/^\d+$/.test(s)) return null
  const n = parseInt(s, 10)
  return n >= min && n <= max ? n : null
}

export async function saveSession(formData: FormData) {
  const supabase = await createClient()

  const eventId = String(formData.get('event_id') ?? '')
  if (!UUID.test(eventId)) redirect('/calendario')

  const failHere = (text: string): never =>
    redirect(`/sesion/${eventId}?error=${encodeURIComponent(text)}`)

  const rpe = intIn(formData.get('rpe'), 1, 10)
  const feeling = intIn(formData.get('feeling'), 1, 5)
  const duration = intIn(formData.get('duration_min'), 1, 600)
  const notes = String(formData.get('notes') ?? '').trim() || null

  if (rpe === null) failHere('Elegí el esfuerzo de la sesión (1 a 10).')
  if (feeling === null) failHere('Elegí cómo te sentiste.')
  if (duration === null) failHere('La duración tiene que ser de 1 a 600 minutos.')

  // RLS: solo encuentra eventos propios
  const { data: event } = await supabase
    .from('calendar_events')
    .select('id, kind, starts_at')
    .eq('id', eventId)
    .maybeSingle()

  if (!event) redirect('/calendario?error=' + encodeURIComponent('No se encontró el evento.'))

  const eventDate = isoDateInTZ(event.starts_at)
  const week = mondayOf(eventDate)

  // Evitar registrar dos veces la misma sesion
  const { data: existing } = await supabase
    .from('session_logs')
    .select('id')
    .eq('event_id', eventId)
    .limit(1)

  if (existing && existing.length > 0) {
    redirect(
      `/calendario?semana=${week}&error=` +
        encodeURIComponent('Esa sesión ya estaba registrada.')
    )
  }

  const sessionKind =
    event.kind === 'track' ? 'track' : event.kind === 'gym' ? 'gym' : 'other'

  const { data: session, error } = await supabase
    .from('session_logs')
    .insert({
      event_id: eventId,
      kind: sessionKind,
      started_at: event.starts_at,
      duration_min: duration,
      rpe,
      feeling,
      notes,
    })
    .select('id')
    .single()

  if (error || !session) failHere('No se pudo guardar la sesión.')

  // Molestia (opcional): solo si se eligio una zona
  const zone = String(formData.get('pain_zone') ?? '')
  let painWarning = false

  if (zone) {
    const painType = String(formData.get('pain_type') ?? '')
    const intensity = intIn(formData.get('pain_intensity'), 0, 10)

    if (!PAIN_TYPES.includes(painType) || intensity === null) {
      redirect(
        `/calendario?semana=${week}&error=` +
          encodeURIComponent(
            'La sesión se guardó, pero la molestia no: revisá el tipo y la intensidad.'
          )
      )
    }

    const { error: painError } = await supabase.from('pain_reports').insert({
      session_id: session!.id,
      zone_code: zone,
      pain_type: painType,
      intensity,
      reported_on: eventDate,
    })

    if (painError) {
      redirect(
        `/calendario?semana=${week}&error=` +
          encodeURIComponent('La sesión se guardó, pero no se pudo guardar la molestia.')
      )
    }

    painWarning = painType === 'agudo' || (intensity ?? 0) >= 6
  }

  revalidatePath('/calendario')

  const message = painWarning
    ? 'Sesión registrada. Si la molestia es aguda o persiste, conviene que la evalúe un profesional antes de seguir con velocidad.'
    : 'Sesión registrada.'

  redirect(`/calendario?semana=${week}&message=${encodeURIComponent(message)}`)
}