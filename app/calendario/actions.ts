'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import {
  addDays,
  daysBetween,
  isValidISO,
  isValidTime,
  isoDateInTZ,
  mondayOf,
  toTimestamp,
} from '@/lib/dates'

const KINDS = ['track', 'gym', 'daily_life', 'competition', 'other'] as const
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DAY_NAMES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']

// PostgREST pone la lista de ids en la direccion de la consulta: se pide de a tandas
const CHUNK = 50

// A que eventos de una serie se aplica la accion
type Scope = 'this' | 'following' | 'all'

function parseScope(raw: FormDataEntryValue | null): Scope {
  const s = String(raw ?? '')
  return s === 'following' || s === 'all' ? s : 'this'
}

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
  // Marca unica: hace que el calendario se reinicie con los datos nuevos y muestre el aviso
  url.searchParams.set('t', Date.now().toString())
  redirect(url.pathname + url.search)
}

function refresh() {
  revalidatePath('/calendario')
  revalidatePath('/')
  revalidatePath('/progreso')
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

type Supa = Awaited<ReturnType<typeof createClient>>

type SeriesEvent = {
  id: string
  starts_at: string
  kind: string
  is_planned_training: boolean
  series_id: string | null
}

// De los ids dados, cuales ya tienen una sesion registrada
async function idsWithSession(supabase: Supa, ids: string[]): Promise<Set<string>> {
  const found = new Set<string>()
  for (const part of chunk(ids, CHUNK)) {
    const { data } = await supabase.from('session_logs').select('event_id').in('event_id', part)
    for (const row of (data ?? []) as { event_id: string | null }[]) {
      if (row.event_id) found.add(row.event_id)
    }
  }
  return found
}

// Eventos a los que aplica la accion: solo este, este y los siguientes, o toda la serie
async function eventsInScope(
  supabase: Supa,
  current: SeriesEvent,
  scope: Scope
): Promise<SeriesEvent[]> {
  if (scope === 'this' || !current.series_id) return [current]

  let query = supabase
    .from('calendar_events')
    .select('id, starts_at, kind, is_planned_training, series_id')
    .eq('series_id', current.series_id)
    .order('starts_at')
  if (scope === 'following') query = query.gte('starts_at', current.starts_at)

  const { data } = await query
  const list = (data ?? []) as SeriesEvent[]
  return list.length > 0 ? list : [current]
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

  // ---- Dias de la semana (0 = lunes ... 6 = domingo) ----
  // Si no se marca ninguno, se usa el dia de la fecha elegida: queda igual que antes
  // (el mismo dia, repetido semana a semana).
  const picked = [...new Set(formData.getAll('days').map((v) => Number(v)))]
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
    .sort((a, b) => a - b)
  const weekdays = picked.length > 0 ? picked : [daysBetween(mondayOf(date), date)]

  // Empieza en la semana de la fecha elegida. En cada semana se crea un evento por cada
  // dia marcado, y se omiten los dias anteriores a la fecha elegida (no se crean eventos
  // en el pasado).
  const firstMonday = mondayOf(date)
  const dates: string[] = []
  for (let week = 0; week < repeat; week++) {
    for (const weekday of weekdays) {
      const eventDate = addDays(firstMonday, 7 * week + weekday)
      if (eventDate >= date) dates.push(eventDate)
    }
  }

  if (dates.length === 0) {
    back(
      returnTo,
      'error',
      'Con esos días no queda ningún evento a partir de la fecha elegida. Probá con más semanas o con otra fecha de inicio.'
    )
  }

  // Los eventos creados juntos comparten una serie (si es uno solo, no hace falta)
  const seriesId = dates.length > 1 ? crypto.randomUUID() : null

  const rows = dates.map((d) => ({
    kind,
    title,
    starts_at: toTimestamp(d, start),
    ends_at: toTimestamp(d, end),
    is_planned_training: planned,
    notes,
    series_id: seriesId,
  }))

  const { error } = await supabase.from('calendar_events').insert(rows)
  if (error) back(returnTo, 'error', 'No se pudo guardar el evento.')

  refresh()

  const message =
    rows.length === 1
      ? 'Evento creado.'
      : `Se crearon ${rows.length} eventos (${weekdays.map((d) => DAY_NAMES[d]).join(', ')}).`
  back(returnTo, 'message', message)
}

export async function updateEvent(formData: FormData) {
  const supabase = await createClient()
  const returnTo = safeReturn(formData.get('return_to'))

  const id = String(formData.get('id') ?? '')
  const title = String(formData.get('title') ?? '').trim()
  const kind = String(formData.get('kind') ?? '')
  const date = String(formData.get('date') ?? '')
  const start = String(formData.get('start') ?? '')
  const end = String(formData.get('end') ?? '')
  const notes = String(formData.get('notes') ?? '').trim() || null
  const planned = formData.get('planned') === 'on'
  const scope = parseScope(formData.get('scope'))

  if (!UUID.test(id)) back(returnTo, 'error', 'Evento no encontrado.')
  if (!title) back(returnTo, 'error', 'Poné un título.')
  if (!isValidISO(date) || !isValidTime(start) || !isValidTime(end)) {
    back(returnTo, 'error', 'Revisá la fecha y las horas.')
  }
  if (end <= start) {
    back(returnTo, 'error', 'La hora de fin tiene que ser posterior a la de inicio.')
  }

  // RLS: solo encuentra eventos propios
  const { data: existing } = await supabase
    .from('calendar_events')
    .select('id, starts_at, kind, is_planned_training, series_id')
    .eq('id', id)
    .maybeSingle()

  if (!existing) back(returnTo, 'error', 'No se encontró el evento.')
  const current = existing as SeriesEvent

  const targets = await eventsInScope(supabase, current, scope)

  // Los eventos con una sesion registrada conservan su tipo y su marca de "planificado":
  // la sesion (repeticiones de pista, series de gimnasio) depende de ellos.
  const withSession = await idsWithSession(
    supabase,
    targets.map((t) => t.id)
  )

  // Un cambio masivo no toca los eventos que ya tienen una sesion registrada: es historial
  // de lo que hiciste. Para corregir uno de esos, se edita ese evento solo.
  const bulk = targets.length > 1
  const editable = bulk ? targets.filter((t) => !withSession.has(t.id)) : targets
  const skipped = targets.length - editable.length

  if (editable.length === 0) {
    back(
      returnTo,
      'error',
      'Esos eventos ya tienen una sesión registrada, así que no se modificaron. Para corregir uno, editá solo ese evento.'
    )
  }

  if (editable.some((t) => !withSession.has(t.id)) && !(KINDS as readonly string[]).includes(kind)) {
    back(returnTo, 'error', 'Elegí un tipo de evento.')
  }

  // Si cambia el dia, se mueven solo los eventos que caen el mismo dia de la semana que
  // este (por ejemplo, todos los martes de una serie de martes y sabado), y los demas
  // conservan su fecha. Para un solo evento, equivale a ponerle la fecha elegida.
  const currentDay = isoDateInTZ(current.starts_at)
  const currentWeekday = daysBetween(mondayOf(currentDay), currentDay)
  const delta = daysBetween(currentDay, date)

  // Correr una serie justo una o mas semanas pisaria eventos de la propia serie
  if (targets.length > 1 && delta !== 0 && delta % 7 === 0) {
    back(
      returnTo,
      'error',
      'Para cambiar el día de una serie, elegí otro día de la semana. Para mover un solo evento a otra semana, editá solo ese evento.'
    )
  }

  let failures = 0
  for (const part of chunk(editable, 25)) {
    const results = await Promise.all(
      part.map(async (t) => {
        const tDay = isoDateInTZ(t.starts_at)
        const sameWeekday = daysBetween(mondayOf(tDay), tDay) === currentWeekday
        const day = sameWeekday ? addDays(tDay, delta) : tDay
        const startsAt = toTimestamp(day, start)
        const endsAt = toTimestamp(day, end)
        const locked = withSession.has(t.id)

        const { error } = await supabase
          .from('calendar_events')
          .update({
            title,
            kind: locked ? t.kind : kind,
            starts_at: startsAt,
            ends_at: endsAt,
            is_planned_training: locked ? t.is_planned_training : planned,
            notes,
          })
          .eq('id', t.id)
        if (error) return false

        // La sesion guarda la fecha del evento: si el evento se mueve, la sesion se mueve con el
        if (locked) {
          const { error: sessionError } = await supabase
            .from('session_logs')
            .update({ started_at: startsAt })
            .eq('event_id', t.id)
          if (sessionError) return false
        }
        return true
      })
    )
    failures += results.filter((ok) => !ok).length
  }

  refresh()

  if (failures > 0) {
    back(
      returnTo,
      'error',
      failures === editable.length
        ? 'No se pudo guardar el evento.'
        : `No se pudieron actualizar ${failures} de ${editable.length} eventos. Revisá el calendario.`
    )
  }

  let message =
    editable.length === 1 ? 'Evento actualizado.' : `Se actualizaron ${editable.length} eventos de la serie.`
  if (skipped > 0) {
    message += ` ${skipped} ya ${skipped === 1 ? 'tenía' : 'tenían'} una sesión registrada y no se ${skipped === 1 ? 'modificó' : 'modificaron'}.`
  }
  back(returnTo, 'message', message)
}

export async function deleteEvent(formData: FormData) {
  const supabase = await createClient()
  const returnTo = safeReturn(formData.get('return_to'))

  const id = String(formData.get('id') ?? '')
  const scope = parseScope(formData.get('scope'))

  if (!UUID.test(id)) back(returnTo, 'error', 'Evento no encontrado.')

  // RLS: solo encuentra eventos propios
  const { data: existing } = await supabase
    .from('calendar_events')
    .select('id, starts_at, kind, is_planned_training, series_id')
    .eq('id', id)
    .maybeSingle()

  if (!existing) back(returnTo, 'error', 'No se encontró el evento.')
  const current = existing as SeriesEvent

  const targets = await eventsInScope(supabase, current, scope)
  let deletable = targets.map((t) => t.id)
  let kept = 0

  // Al borrar varios eventos de una serie, los que ya tienen una sesion registrada se
  // conservan: asi no se pierde el historial de lo que ya hiciste.
  if (scope !== 'this' && current.series_id) {
    const withSession = await idsWithSession(supabase, deletable)
    deletable = deletable.filter((x) => !withSession.has(x))
    kept = targets.length - deletable.length
  }

  if (deletable.length === 0) {
    back(
      returnTo,
      'error',
      'Esos eventos ya tienen una sesión registrada, así que se conservaron.'
    )
  }

  for (const part of chunk(deletable, CHUNK)) {
    const { error } = await supabase.from('calendar_events').delete().in('id', part)
    if (error) {
      refresh()
      back(returnTo, 'error', 'No se pudieron borrar todos los eventos. Revisá el calendario.')
    }
  }

  refresh()

  let message = deletable.length === 1 ? 'Evento borrado.' : `Se borraron ${deletable.length} eventos.`
  if (kept > 0) {
    message += ` ${kept} ya ${kept === 1 ? 'tenía' : 'tenían'} una sesión registrada y se ${kept === 1 ? 'conservó' : 'conservaron'}.`
  }
  back(returnTo, 'message', message)
}
