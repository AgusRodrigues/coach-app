'use client'

import { useOptimistic, useState } from 'react'
import Link from 'next/link'
import {
  addDays,
  addMonths,
  dayLabel,
  mondayOf,
  monthGrid,
  monthLabel,
  shortDate,
  toTimestamp,
} from '@/lib/dates'
import { MONTHS_AROUND } from '@/lib/calendar-window'
import {
  isEventKind,
  parseScope,
  pickScope,
  planCreateDates,
  planDelete,
  planUpdate,
  readCreateExtras,
  readEventInput,
  validateEventInput,
  type ActionResult,
  type EventPatch,
} from '@/lib/event-rules'
import { createEvent, deleteEvent, updateEvent } from './actions'
import { DayBlock, KINDS, NewEventForm, type CalComp, type CalEvent } from './parts'

// El servidor manda los datos de ~3 meses. Con esos datos, cambiar de vista, de semana,
// de mes o de dia no necesita volver al servidor: se resuelve aca, al instante.
// Solo si te alejas de lo cargado, el enlace funciona como una navegacion normal.

type View = 'semana' | 'mes'
type Target = { view: View; selected: string; viewMonth: string }
export type CalEventDay = CalEvent & { day: string }

type Notice = { kind: 'ok' | 'error'; text: string }

// Cambios que se muestran al instante, antes de que el servidor confirme. Si el servidor
// los rechaza, desaparecen solos y se vuelve a lo que habia.
type OptimisticChange =
  | { type: 'delete'; ids: string[] }
  | { type: 'create'; rows: CalEventDay[] }
  | { type: 'update'; patches: { id: string; patch: EventPatch }[] }

function applyChange(state: CalEventDay[], change: OptimisticChange): CalEventDay[] {
  switch (change.type) {
    case 'delete': {
      const gone = new Set(change.ids)
      return state.filter((e) => !gone.has(e.id))
    }
    case 'create':
      return [...state, ...change.rows]
    case 'update': {
      const byId = new Map(change.patches.map((p) => [p.id, p.patch]))
      return state.map((e) => {
        const patch = byId.get(e.id)
        // starts_at lleva la fecha local de Buenos Aires: sus primeros 10 caracteres son el dia
        return patch ? { ...e, ...patch, day: patch.starts_at.slice(0, 10) } : e
      })
    }
  }
}

type Props = {
  initialView: View
  initialSelected: string
  initialViewMonth: string
  centerMonth: string // mes alrededor del cual se cargaron los datos
  winStart: string // primer dia cargado
  winEnd: string // ultimo dia cargado
  today: string
  events: CalEventDay[]
  comps: CalComp[]
  doneEntries: [string, number | null][]
  error?: string
  message?: string
}

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

const arrowClass =
  'flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-700 text-lg'

// Direccion equivalente a un estado: sirve para el enlace, para recargar y para volver
// despues de guardar algo.
function hrefFor(t: Target): string {
  return t.view === 'mes'
    ? `/calendario?vista=mes&mes=${t.viewMonth}&dia=${t.selected}`
    : `/calendario?vista=semana&semana=${mondayOf(t.selected)}`
}

export default function CalendarClient({
  initialView,
  initialSelected,
  initialViewMonth,
  centerMonth,
  winStart,
  winEnd,
  today,
  events,
  comps,
  doneEntries,
  error,
  message,
}: Props) {
  const [view, setView] = useState<View>(initialView)
  const [selected, setSelected] = useState(initialSelected)
  const [viewMonth, setViewMonth] = useState(initialViewMonth)
  const [alertsVisible, setAlertsVisible] = useState(true)
  const [notice, setNotice] = useState<Notice | null>(null)

  // Los eventos que se muestran: los del servidor mas los cambios que todavia se estan guardando
  const [shownEvents, applyChangeNow] = useOptimistic(events, applyChange)

  // ---- Datos indexados por dia ----
  const doneByEvent = new Map<string, number | null>(doneEntries)
  const doneIds = new Set(doneByEvent.keys())

  const byDay = new Map<string, CalEventDay[]>()
  for (const ev of shownEvents) {
    byDay.set(ev.day, [...(byDay.get(ev.day) ?? []), ev])
  }
  // Los eventos recien creados o cambiados se agregan al final: se ordenan por hora
  for (const list of byDay.values()) {
    list.sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))
  }
  const compsByDay = new Map<string, CalComp[]>()
  for (const c of comps) {
    compsByDay.set(c.event_date, [...(compsByDay.get(c.event_date) ?? []), c])
  }

  // ---- Navegacion ----

  // ¿Los datos cargados alcanzan para mostrar ese estado?
  function covered(t: Target): boolean {
    if (t.view === 'mes') {
      return (
        t.viewMonth >= addMonths(centerMonth, -MONTHS_AROUND) &&
        t.viewMonth <= addMonths(centerMonth, MONTHS_AROUND) &&
        t.selected >= winStart &&
        t.selected <= winEnd
      )
    }
    const monday = mondayOf(t.selected)
    return monday >= winStart && addDays(monday, 6) <= winEnd
  }

  // ---- Crear, editar y borrar: se ve al instante y se guarda por detras ----
  // Cada funcion hace tres cosas: (1) valida y calcula el resultado con las MISMAS reglas que el
  // servidor, (2) lo muestra ya, (3) manda el pedido. Si el servidor responde con un error, el
  // cambio se deshace solo y se muestra el aviso.

  // Manda el pedido al servidor y muestra el resultado. Si no hay conexion, el pedido falla con
  // una excepcion: se atrapa, y el cambio mostrado se deshace solo (queda el aviso).
  async function send(run: () => Promise<ActionResult>) {
    try {
      const res = await run()
      setNotice(res.ok ? { kind: 'ok', text: res.message } : { kind: 'error', text: res.error })
    } catch {
      setNotice({
        kind: 'error',
        text: 'No se pudo conectar con el servidor, así que el cambio se deshizo. Revisá tu conexión y probá de nuevo.',
      })
    }
  }

  async function handleCreate(fd: FormData) {
    setNotice(null)
    const input = readEventInput(fd)
    const { repeat, weekdays } = readCreateExtras(fd)

    const invalid = validateEventInput(input) ?? (isEventKind(input.kind) ? null : 'Elegí un tipo de evento.')
    if (invalid) return setNotice({ kind: 'error', text: invalid })

    const dates = planCreateDates(input.date, weekdays, repeat)
    if (dates.length === 0) {
      return setNotice({
        kind: 'error',
        text: 'Con esos días no queda ningún evento a partir de la fecha elegida. Probá con más semanas o con otra fecha de inicio.',
      })
    }

    const tempSeries = dates.length > 1 ? `tmp-${crypto.randomUUID()}` : null
    applyChangeNow({
      type: 'create',
      rows: dates.map((d) => ({
        id: `tmp-${crypto.randomUUID()}`,
        kind: input.kind,
        title: input.title,
        starts_at: toTimestamp(d, input.start),
        ends_at: toTimestamp(d, input.end),
        is_planned_training: input.planned,
        notes: input.notes,
        series_id: tempSeries,
        day: d,
      })),
    })

    await send(() => createEvent(fd))
  }

  async function handleUpdate(fd: FormData) {
    setNotice(null)
    const id = String(fd.get('id') ?? '')
    const scope = parseScope(fd.get('scope'))
    const input = readEventInput(fd)

    const found = shownEvents.find((e) => e.id === id)
    if (!found) return
    const invalid = validateEventInput(input)
    if (invalid) return setNotice({ kind: 'error', text: invalid })

    const targets = pickScope(shownEvents, found, scope)
    const plan = planUpdate(found, targets, doneIds, input)
    if (!plan.ok) return setNotice({ kind: 'error', text: plan.error })

    applyChangeNow({
      type: 'update',
      patches: plan.patches.map(({ id: eventId, patch }) => ({ id: eventId, patch })),
    })

    await send(() => updateEvent(fd))
  }

  async function handleDelete(fd: FormData) {
    setNotice(null)
    const id = String(fd.get('id') ?? '')
    const scope = parseScope(fd.get('scope'))

    const found = shownEvents.find((e) => e.id === id)
    if (!found) return

    const targets = pickScope(shownEvents, found, scope)
    const { ids } = planDelete(found, targets, scope, doneIds)
    if (ids.length === 0) {
      return setNotice({
        kind: 'error',
        text: 'Esos eventos ya tienen una sesión registrada, así que se conservaron.',
      })
    }

    applyChangeNow({ type: 'delete', ids })

    await send(() => deleteEvent(fd))
  }

  function go(t: Target) {
    setView(t.view)
    setSelected(t.selected)
    setViewMonth(t.viewMonth)
    setAlertsVisible(false)
    setNotice(null)
    // Actualiza la direccion sin recargar: asi, recargar o guardar un evento vuelve a este lugar
    window.history.replaceState(null, '', hrefFor(t))
  }

  // Intercepta el enlace solo si los datos alcanzan; si no, navega al servidor como siempre
  function soft(t: Target) {
    return (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return
      }
      if (!covered(t)) return
      e.preventDefault()
      go(t)
    }
  }

  const monday = mondayOf(selected)
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  const todayMonth = today.slice(0, 7)

  const weekTarget: Target = { view: 'semana', selected, viewMonth: selected.slice(0, 7) }
  const monthTarget: Target = { view: 'mes', selected, viewMonth: selected.slice(0, 7) }

  const shiftWeek = (n: number): Target => {
    const s = addDays(selected, 7 * n)
    return { view: 'semana', selected: s, viewMonth: s.slice(0, 7) }
  }
  const shiftMonth = (n: number): Target => {
    const ym = addMonths(viewMonth, n)
    return { view: 'mes', selected: todayMonth === ym ? today : `${ym}-01`, viewMonth: ym }
  }
  const goToday: Target =
    view === 'mes'
      ? { view: 'mes', selected: today, viewMonth: todayMonth }
      : { view: 'semana', selected: today, viewMonth: todayMonth }

  const isMonth = view === 'mes'
  const grid = isMonth ? monthGrid(viewMonth) : []

  return (
    <div className="space-y-4">
      {/* Selector de vista */}
      <div className="grid grid-cols-2 rounded-2xl bg-neutral-900 p-1 text-sm font-semibold">
        <Link
          prefetch={false}
          href={hrefFor(weekTarget)}
          onClick={soft(weekTarget)}
          aria-current={!isMonth ? 'page' : undefined}
          className={`rounded-xl py-2.5 text-center ${
            !isMonth ? 'bg-brand text-on-brand' : 'text-neutral-400'
          }`}
        >
          Semana
        </Link>
        <Link
          prefetch={false}
          href={hrefFor(monthTarget)}
          onClick={soft(monthTarget)}
          aria-current={isMonth ? 'page' : undefined}
          className={`rounded-xl py-2.5 text-center ${
            isMonth ? 'bg-brand text-on-brand' : 'text-neutral-400'
          }`}
        >
          Mes
        </Link>
      </div>

      {/* Navegacion del periodo */}
      {isMonth ? (
        <div className="flex items-center justify-between">
          <Link
            prefetch={false}
            href={hrefFor(shiftMonth(-1))}
            onClick={soft(shiftMonth(-1))}
            className={arrowClass}
            aria-label="Mes anterior"
          >
            ←
          </Link>
          <div className="text-center">
            <p className="font-display text-3xl font-semibold capitalize leading-none">
              {monthLabel(viewMonth)}
            </p>
            {viewMonth !== todayMonth && (
              <Link
                prefetch={false}
                href={hrefFor(goToday)}
                onClick={soft(goToday)}
                className="text-xs text-brand-fg underline"
              >
                Ir a este mes
              </Link>
            )}
          </div>
          <Link
            prefetch={false}
            href={hrefFor(shiftMonth(1))}
            onClick={soft(shiftMonth(1))}
            className={arrowClass}
            aria-label="Mes siguiente"
          >
            →
          </Link>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <Link
            prefetch={false}
            href={hrefFor(shiftWeek(-1))}
            onClick={soft(shiftWeek(-1))}
            className={arrowClass}
            aria-label="Semana anterior"
          >
            ←
          </Link>
          <div className="text-center">
            <p className="font-display text-3xl font-semibold leading-none">
              {shortDate(monday)} al {shortDate(weekDays[6])}
            </p>
            {monday !== mondayOf(today) && (
              <Link
                prefetch={false}
                href={hrefFor(goToday)}
                onClick={soft(goToday)}
                className="text-xs text-brand-fg underline"
              >
                Ir a esta semana
              </Link>
            )}
          </div>
          <Link
            prefetch={false}
            href={hrefFor(shiftWeek(1))}
            onClick={soft(shiftWeek(1))}
            className={arrowClass}
            aria-label="Semana siguiente"
          >
            →
          </Link>
        </div>
      )}

      {/* Aviso del ultimo cambio; si no hay, el que llego en la direccion (por ejemplo, al
          volver de guardar una sesion) */}
      {(() => {
        const shown: Notice | null =
          notice ??
          (alertsVisible
            ? error
              ? { kind: 'error', text: error }
              : message
                ? { kind: 'ok', text: message }
                : null
            : null)
        if (!shown) return null
        return shown.kind === 'error' ? (
          <p role="alert" className="rounded-xl bg-red-950 p-3 text-sm text-red-300">
            {shown.text}
          </p>
        ) : (
          <p role="status" className="rounded-xl bg-emerald-950 p-3 text-sm text-emerald-300">
            {shown.text}
          </p>
        )
      })()}

      <NewEventForm defaultDate={selected} onCreate={handleCreate} />

      {isMonth ? (
        <>
          {/* Grilla mensual: tocar un dia cambia el detalle al instante */}
          <section className="rounded-2xl bg-neutral-900 p-3" aria-label={monthLabel(viewMonth)}>
            <div className="mb-1 grid grid-cols-7 text-center text-xs font-medium text-neutral-500">
              {WEEKDAYS.map((w, i) => (
                <span key={i}>{w}</span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {grid.map((day) => {
                const inMonth = day.slice(0, 7) === viewMonth
                const dayEvents = byDay.get(day) ?? []
                const dayComps = compsByDay.get(day) ?? []

                // Un punto por tipo de evento (maximo 3)
                const kinds: string[] = []
                for (const e of dayEvents) if (!kinds.includes(e.kind)) kinds.push(e.kind)
                if (dayComps.length > 0 && !kinds.includes('competition')) {
                  kinds.push('competition')
                }

                const isSelected = day === selected
                const isToday = day === today

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => go({ view: 'mes', selected: day, viewMonth })}
                    aria-label={dayLabel(day)}
                    aria-pressed={isSelected}
                    className={`flex aspect-square flex-col items-center justify-start gap-1 rounded-xl pt-1.5 ${
                      isSelected ? 'bg-neutral-800 ring-2 ring-brand' : ''
                    } ${inMonth ? '' : 'opacity-40'}`}
                  >
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-sm ${
                        isToday ? 'bg-brand font-semibold text-on-brand' : ''
                      }`}
                    >
                      {Number(day.slice(8))}
                    </span>
                    <span className="flex gap-0.5">
                      {kinds.slice(0, 3).map((k) => (
                        <span
                          key={k}
                          className={`h-1.5 w-1.5 rounded-full ${KINDS[k]?.dot ?? 'bg-neutral-500'}`}
                        />
                      ))}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Referencias de los puntos */}
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-neutral-700 pt-3 text-xs text-neutral-400">
              {['track', 'gym', 'daily_life', 'competition'].map((k) => (
                <li key={k} className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${KINDS[k].dot}`} />
                  {KINDS[k].label}
                </li>
              ))}
            </ul>
          </section>

          {/* Detalle del dia elegido */}
          <DayBlock
            key={selected}
            animateIn
            day={selected}
            today={today}
            events={byDay.get(selected) ?? []}
            comps={compsByDay.get(selected) ?? []}
            doneByEvent={doneByEvent}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        </>
      ) : (
        weekDays.map((day) => (
          <DayBlock
            key={day}
            day={day}
            today={today}
            events={byDay.get(day) ?? []}
            comps={compsByDay.get(day) ?? []}
            doneByEvent={doneByEvent}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        ))
      )}
    </div>
  )
}
