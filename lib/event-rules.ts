// Reglas de los eventos del calendario, en funciones puras (sin base de datos).
//
// Las usan DOS lugares, y por eso estan aca y no repetidas:
//   - el servidor (app/calendario/actions.ts), que es el que decide y guarda;
//   - el telefono (CalendarClient), que las aplica al instante para mostrar el resultado
//     antes de que el servidor responda.
// Asi, lo que ves al instante es exactamente lo que el servidor va a confirmar.

import {
  addDays,
  daysBetween,
  isValidISO,
  isValidTime,
  isoDateInTZ,
  mondayOf,
  toTimestamp,
} from '@/lib/dates'

export const EVENT_KINDS = ['track', 'gym', 'daily_life', 'competition', 'other'] as const
export const DAY_NAMES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']

// A que eventos de una serie se aplica una edicion o un borrado
export type Scope = 'this' | 'following' | 'all'

export type ActionResult = { ok: true; message: string } | { ok: false; error: string }

export function parseScope(raw: unknown): Scope {
  const s = String(raw ?? '')
  return s === 'following' || s === 'all' ? s : 'this'
}

export function isEventKind(kind: string): boolean {
  return (EVENT_KINDS as readonly string[]).includes(kind)
}

// ---------------------------------------------------------------------
// Lectura y validacion de los datos del formulario
// ---------------------------------------------------------------------

export type EventInput = {
  title: string
  kind: string
  date: string
  start: string
  end: string
  notes: string | null
  planned: boolean
}

export function readEventInput(fd: FormData): EventInput {
  return {
    title: String(fd.get('title') ?? '').trim(),
    kind: String(fd.get('kind') ?? ''),
    date: String(fd.get('date') ?? ''),
    start: String(fd.get('start') ?? ''),
    end: String(fd.get('end') ?? ''),
    notes: String(fd.get('notes') ?? '').trim() || null,
    planned: fd.get('planned') === 'on',
  }
}

// Devuelve el mensaje de error, o null si esta todo bien
export function validateEventInput(input: EventInput): string | null {
  if (!input.title) return 'Poné un título.'
  if (!isValidISO(input.date) || !isValidTime(input.start) || !isValidTime(input.end)) {
    return 'Revisá la fecha y las horas.'
  }
  if (input.end <= input.start) return 'La hora de fin tiene que ser posterior a la de inicio.'
  return null
}

// ---------------------------------------------------------------------
// Crear
// ---------------------------------------------------------------------

export function readCreateExtras(fd: FormData): { repeat: number; weekdays: number[] } {
  const repeat = Math.min(Math.max(parseInt(String(fd.get('repeat') ?? '1'), 10) || 1, 1), 26)
  const weekdays = fd.getAll('days').map((v) => Number(v))
  return { repeat, weekdays }
}

// Dias de la semana a usar (0 = lunes ... 6 = domingo). Si no se marca ninguno, se usa el
// dia de la fecha elegida: el mismo dia, repetido semana a semana.
export function resolveWeekdays(date: string, weekdays: number[]): number[] {
  const picked = [...new Set(weekdays)]
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
    .sort((a, b) => a - b)
  return picked.length > 0 ? picked : [daysBetween(mondayOf(date), date)]
}

// Fechas de los eventos a crear. Empieza en la semana de la fecha elegida y omite los dias
// anteriores a esa fecha (no se crean eventos en el pasado).
export function planCreateDates(date: string, weekdays: number[], repeat: number): string[] {
  const days = resolveWeekdays(date, weekdays)
  const firstMonday = mondayOf(date)
  const out: string[] = []

  for (let week = 0; week < repeat; week++) {
    for (const weekday of days) {
      const eventDate = addDays(firstMonday, 7 * week + weekday)
      if (eventDate >= date) out.push(eventDate)
    }
  }
  return out
}

// ---------------------------------------------------------------------
// Series: a que eventos se aplica una accion
// ---------------------------------------------------------------------

export type EventLike = {
  id: string
  starts_at: string
  kind: string
  is_planned_training: boolean
  series_id: string | null
}

// Version en memoria (la usa el telefono, con los eventos que ya tiene cargados)
export function pickScope<T extends EventLike>(all: T[], current: T, scope: Scope): T[] {
  if (scope === 'this' || !current.series_id) return [current]

  const from = Date.parse(current.starts_at)
  const list = all.filter(
    (e) => e.series_id === current.series_id && (scope === 'all' || Date.parse(e.starts_at) >= from)
  )
  return list.length > 0 ? list : [current]
}

// ---------------------------------------------------------------------
// Editar
// ---------------------------------------------------------------------

export type EventPatch = {
  title: string
  kind: string
  starts_at: string
  ends_at: string
  is_planned_training: boolean
  notes: string | null
}

export type UpdatePlan =
  | { ok: true; patches: { id: string; patch: EventPatch; locked: boolean }[]; skipped: number }
  | { ok: false; error: string }

// Que se le cambia a cada evento. `withSession` son los eventos que ya tienen una sesion
// registrada.
//  - Un cambio masivo no toca los eventos con sesion registrada (es historial).
//  - Si cambia el dia, se mueven solo los eventos del mismo dia de la semana que este.
//  - Un evento con sesion (editado solo) conserva su tipo y su marca de "planificado".
export function planUpdate(
  current: EventLike,
  targets: EventLike[],
  withSession: ReadonlySet<string>,
  input: EventInput
): UpdatePlan {
  const bulk = targets.length > 1
  const editable = bulk ? targets.filter((t) => !withSession.has(t.id)) : targets
  const skipped = targets.length - editable.length

  if (editable.length === 0) {
    return {
      ok: false,
      error:
        'Esos eventos ya tienen una sesión registrada, así que no se modificaron. Para corregir uno, editá solo ese evento.',
    }
  }

  if (editable.some((t) => !withSession.has(t.id)) && !isEventKind(input.kind)) {
    return { ok: false, error: 'Elegí un tipo de evento.' }
  }

  const currentDay = isoDateInTZ(current.starts_at)
  const currentWeekday = daysBetween(mondayOf(currentDay), currentDay)
  const delta = daysBetween(currentDay, input.date)

  // Correr una serie justo una o mas semanas pisaria eventos de la propia serie
  if (bulk && delta !== 0 && delta % 7 === 0) {
    return {
      ok: false,
      error:
        'Para cambiar el día de una serie, elegí otro día de la semana. Para mover un solo evento a otra semana, editá solo ese evento.',
    }
  }

  const patches = editable.map((t) => {
    const tDay = isoDateInTZ(t.starts_at)
    const sameWeekday = daysBetween(mondayOf(tDay), tDay) === currentWeekday
    const day = sameWeekday ? addDays(tDay, delta) : tDay
    const locked = withSession.has(t.id)

    return {
      id: t.id,
      locked,
      patch: {
        title: input.title,
        kind: locked ? t.kind : input.kind,
        starts_at: toTimestamp(day, input.start),
        ends_at: toTimestamp(day, input.end),
        is_planned_training: locked ? t.is_planned_training : input.planned,
        notes: input.notes,
      },
    }
  })

  return { ok: true, patches, skipped }
}

// ---------------------------------------------------------------------
// Borrar
// ---------------------------------------------------------------------

// Al borrar varios eventos de una serie, los que ya tienen sesion registrada se conservan.
export function planDelete(
  current: EventLike,
  targets: EventLike[],
  scope: Scope,
  withSession: ReadonlySet<string>
): { ids: string[]; kept: number } {
  const protect = scope !== 'this' && !!current.series_id
  const ids = targets.filter((t) => !protect || !withSession.has(t.id)).map((t) => t.id)
  return { ids, kept: targets.length - ids.length }
}
