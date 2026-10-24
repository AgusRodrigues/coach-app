'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { timed } from '@/lib/timing'
import { toTimestamp } from '@/lib/dates'
import {
  DAY_NAMES,
  isEventKind,
  parseScope,
  planCreateDates,
  planDelete,
  planUpdate,
  readCreateExtras,
  readEventInput,
  resolveWeekdays,
  validateEventInput,
  type ActionResult,
  type EventLike,
  type Scope,
} from '@/lib/event-rules'

// Estas acciones NO redirigen: devuelven un resultado. El calendario ya mostro el cambio al
// instante (en el telefono); aca se guarda de verdad, y si algo falla el telefono lo deshace.
// Las reglas (que fechas, que se mueve, que se protege) viven en lib/event-rules.ts y las
// comparten el servidor y el telefono.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// PostgREST pone la lista de ids en la direccion de la consulta: se pide de a tandas
const CHUNK = 50

const fail = (error: string): ActionResult => ({ ok: false, error })
const ok = (message: string): ActionResult => ({ ok: true, message })

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
  current: EventLike,
  scope: Scope
): Promise<EventLike[]> {
  if (scope === 'this' || !current.series_id) return [current]

  let query = supabase
    .from('calendar_events')
    .select('id, starts_at, kind, is_planned_training, series_id')
    .eq('series_id', current.series_id)
    .order('starts_at')
  if (scope === 'following') query = query.gte('starts_at', current.starts_at)

  const { data } = await query
  const list = (data ?? []) as EventLike[]
  return list.length > 0 ? list : [current]
}

export async function createEvent(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()

  const input = readEventInput(formData)
  const { repeat, weekdays } = readCreateExtras(formData)

  const invalid = validateEventInput(input)
  if (invalid) return fail(invalid)
  if (!isEventKind(input.kind)) return fail('Elegí un tipo de evento.')

  const dates = planCreateDates(input.date, weekdays, repeat)
  if (dates.length === 0) {
    return fail(
      'Con esos días no queda ningún evento a partir de la fecha elegida. Probá con más semanas o con otra fecha de inicio.'
    )
  }

  // Los eventos creados juntos comparten una serie (si es uno solo, no hace falta)
  const seriesId = dates.length > 1 ? crypto.randomUUID() : null

  const rows = dates.map((d) => ({
    kind: input.kind,
    title: input.title,
    starts_at: toTimestamp(d, input.start),
    ends_at: toTimestamp(d, input.end),
    is_planned_training: input.planned,
    notes: input.notes,
    series_id: seriesId,
  }))

  const { error } = await supabase.from('calendar_events').insert(rows)
  if (error) return fail('No se pudo guardar el evento.')

  refresh()

  if (rows.length === 1) return ok('Evento creado.')
  const names = resolveWeekdays(input.date, weekdays).map((d) => DAY_NAMES[d])
  return ok(`Se crearon ${rows.length} eventos (${names.join(', ')}).`)
}

export async function updateEvent(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()

  const id = String(formData.get('id') ?? '')
  const scope = parseScope(formData.get('scope'))
  const input = readEventInput(formData)

  if (!UUID.test(id)) return fail('Evento no encontrado.')
  const invalid = validateEventInput(input)
  if (invalid) return fail(invalid)

  // RLS: solo encuentra eventos propios
  const { data: existing } = await supabase
    .from('calendar_events')
    .select('id, starts_at, kind, is_planned_training, series_id')
    .eq('id', id)
    .maybeSingle()

  if (!existing) return fail('No se encontró el evento.')
  const current = existing as EventLike

  const targets = await eventsInScope(supabase, current, scope)
  const withSession = await idsWithSession(
    supabase,
    targets.map((t) => t.id)
  )

  // Que se le cambia a cada evento (la misma funcion que usa el telefono)
  const plan = planUpdate(current, targets, withSession, input)
  if (!plan.ok) return fail(plan.error)

  let failures = 0
  for (const part of chunk(plan.patches, 25)) {
    const results = await Promise.all(
      part.map(async ({ id: eventId, patch, locked }) => {
        const { error } = await supabase.from('calendar_events').update(patch).eq('id', eventId)
        if (error) return false

        // La sesion guarda la fecha del evento: si el evento se mueve, la sesion se mueve con el
        // (solo pasa al editar un unico evento ya registrado)
        if (locked) {
          const { error: sessionError } = await supabase
            .from('session_logs')
            .update({ started_at: patch.starts_at })
            .eq('event_id', eventId)
          if (sessionError) return false
        }
        return true
      })
    )
    failures += results.filter((done) => !done).length
  }

  refresh()

  if (failures > 0) {
    return fail(
      failures === plan.patches.length
        ? 'No se pudo guardar el evento.'
        : `No se pudieron actualizar ${failures} de ${plan.patches.length} eventos. Revisá el calendario.`
    )
  }

  const count = plan.patches.length
  let message = count === 1 ? 'Evento actualizado.' : `Se actualizaron ${count} eventos de la serie.`
  if (plan.skipped > 0) {
    const n = plan.skipped
    message += ` ${n} ya ${n === 1 ? 'tenía' : 'tenían'} una sesión registrada y no se ${n === 1 ? 'modificó' : 'modificaron'}.`
  }
  return ok(message)
}

export async function deleteEvent(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()

  const id = String(formData.get('id') ?? '')
  const scope = parseScope(formData.get('scope'))

  if (!UUID.test(id)) return fail('Evento no encontrado.')

  // Borrar un solo evento no necesita leerlo antes: se borra directo.
  // RLS garantiza que solo se pueden borrar eventos propios.
  if (scope === 'this') {
    const { error } = await timed(
      'deleteEvent: borrar uno',
      supabase.from('calendar_events').delete().eq('id', id)
    )
    refresh()
    return error ? fail('No se pudo borrar el evento.') : ok('Evento borrado.')
  }

  // Varios eventos de una serie: hay que saber a cual pertenece
  // RLS: solo encuentra eventos propios
  const { data: existing } = await supabase
    .from('calendar_events')
    .select('id, starts_at, kind, is_planned_training, series_id')
    .eq('id', id)
    .maybeSingle()

  if (!existing) return fail('No se encontró el evento.')
  const current = existing as EventLike

  const targets = await eventsInScope(supabase, current, scope)
  const withSession = await idsWithSession(
    supabase,
    targets.map((t) => t.id)
  )

  // Los que ya tienen una sesion registrada se conservan: no se pierde el historial
  const { ids, kept } = planDelete(current, targets, scope, withSession)

  if (ids.length === 0) {
    return fail('Esos eventos ya tienen una sesión registrada, así que se conservaron.')
  }

  for (const part of chunk(ids, CHUNK)) {
    const { error } = await supabase.from('calendar_events').delete().in('id', part)
    if (error) {
      refresh()
      return fail('No se pudieron borrar todos los eventos. Revisá el calendario.')
    }
  }

  refresh()

  let message = ids.length === 1 ? 'Evento borrado.' : `Se borraron ${ids.length} eventos.`
  if (kept > 0) {
    message += ` ${kept} ya ${kept === 1 ? 'tenía' : 'tenían'} una sesión registrada y se ${kept === 1 ? 'conservó' : 'conservaron'}.`
  }
  return ok(message)
}
