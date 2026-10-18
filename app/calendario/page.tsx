import { Suspense } from 'react'
import Link from 'next/link'
import { connection } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import {
  addDays,
  addMonths,
  dayLabel,
  isValidISO,
  isValidMonth,
  isoDateInTZ,
  mondayOf,
  monthGrid,
  monthLabel,
  shortDate,
  todayISO,
} from '@/lib/dates'
import { DayBlock, KINDS, NewEventForm, type CalComp, type CalEvent } from './parts'

type Params = Promise<{
  vista?: string
  semana?: string
  mes?: string
  dia?: string
  error?: string
  message?: string
}>

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

const arrowClass =
  'flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-700 text-lg'

// Todo lo que lee sesion o datos va dentro de Suspense, y empieza con connection()
async function CalendarContent({ searchParams }: { searchParams: Params }) {
  await connection()

  const { vista, semana, mes, dia, error, message } = await searchParams
  const today = todayISO()
  const isMonth = vista === 'mes'

  // ---- Que dias se muestran y a donde se vuelve despues de guardar ----
  let days: string[]
  let ym = ''
  let monday = ''
  let selected = ''
  let returnTo: string

  if (isMonth) {
    const fromDia = dia && isValidISO(dia) ? dia : null
    ym = mes && isValidMonth(mes) ? mes : (fromDia ?? today).slice(0, 7)
    days = monthGrid(ym)
    selected =
      fromDia && fromDia.slice(0, 7) === ym
        ? fromDia
        : today.slice(0, 7) === ym
          ? today
          : `${ym}-01`
    returnTo = `/calendario?vista=mes&mes=${ym}&dia=${selected}`
  } else {
    monday = mondayOf(semana && isValidISO(semana) ? semana : today)
    days = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
    returnTo = `/calendario?vista=semana&semana=${monday}`
  }

  const from = days[0]
  const to = addDays(days[days.length - 1], 1)

  // ---- Datos del periodo ----
  const supabase = await createClient()

  const { data, error: dbError } = await supabase
    .from('calendar_events')
    .select('id, kind, title, starts_at, ends_at, is_planned_training, notes')
    .gte('starts_at', `${from}T00:00:00-03:00`)
    .lt('starts_at', `${to}T00:00:00-03:00`)
    .order('starts_at')
  const events = (data ?? []) as CalEvent[]

  const { data: compData } = await supabase
    .from('competitions')
    .select('id, name, discipline, importance, event_date')
    .gte('event_date', from)
    .lt('event_date', to)
    .order('event_date')
  const competitions = (compData ?? []) as CalComp[]

  // Sesiones ya registradas (event_id -> RPE)
  const doneByEvent = new Map<string, number | null>()
  if (events.length > 0) {
    const { data: logs } = await supabase
      .from('session_logs')
      .select('event_id, rpe')
      .in(
        'event_id',
        events.map((e) => e.id)
      )
    for (const log of (logs ?? []) as { event_id: string | null; rpe: number | null }[]) {
      if (log.event_id) doneByEvent.set(log.event_id, log.rpe)
    }
  }

  const byDay = new Map<string, CalEvent[]>()
  for (const ev of events) {
    const key = isoDateInTZ(ev.starts_at)
    byDay.set(key, [...(byDay.get(key) ?? []), ev])
  }
  const compsByDay = new Map<string, CalComp[]>()
  for (const c of competitions) {
    compsByDay.set(c.event_date, [...(compsByDay.get(c.event_date) ?? []), c])
  }

  // ---- Enlaces del selector Semana | Mes ----
  const refDay = isMonth ? selected : days.includes(today) ? today : monday
  const weekHref = `/calendario?vista=semana&semana=${mondayOf(refDay)}`
  const monthHref = `/calendario?vista=mes&mes=${refDay.slice(0, 7)}&dia=${refDay}`

  const defaultDate = isMonth ? selected : refDay

  return (
    <div key={isMonth ? `m-${ym}` : `w-${monday}`} className="space-y-4">
      {/* Selector de vista */}
      <div className="grid grid-cols-2 rounded-2xl bg-neutral-900 p-1 text-sm font-semibold">
        <Link
          href={weekHref}
          aria-current={!isMonth ? 'page' : undefined}
          className={`rounded-xl py-2.5 text-center ${
            !isMonth ? 'bg-brand text-on-brand' : 'text-neutral-400'
          }`}
        >
          Semana
        </Link>
        <Link
          href={monthHref}
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
            href={`/calendario?vista=mes&mes=${addMonths(ym, -1)}`}
            className={arrowClass}
            aria-label="Mes anterior"
          >
            ←
          </Link>
          <div className="text-center">
            <p className="font-display text-3xl font-semibold capitalize leading-none">
              {monthLabel(ym)}
            </p>
            {ym !== today.slice(0, 7) && (
              <Link
                href={`/calendario?vista=mes&mes=${today.slice(0, 7)}&dia=${today}`}
                className="text-xs text-brand-fg underline"
              >
                Ir a este mes
              </Link>
            )}
          </div>
          <Link
            href={`/calendario?vista=mes&mes=${addMonths(ym, 1)}`}
            className={arrowClass}
            aria-label="Mes siguiente"
          >
            →
          </Link>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <Link
            href={`/calendario?vista=semana&semana=${addDays(monday, -7)}`}
            className={arrowClass}
            aria-label="Semana anterior"
          >
            ←
          </Link>
          <div className="text-center">
            <p className="font-display text-3xl font-semibold leading-none">
              {shortDate(monday)} al {shortDate(days[6])}
            </p>
            {monday !== mondayOf(today) && (
              <Link
                href="/calendario?vista=semana"
                className="text-xs text-brand-fg underline"
              >
                Ir a esta semana
              </Link>
            )}
          </div>
          <Link
            href={`/calendario?vista=semana&semana=${addDays(monday, 7)}`}
            className={arrowClass}
            aria-label="Semana siguiente"
          >
            →
          </Link>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-xl bg-red-950 p-3 text-sm text-red-300">
          {error}
        </p>
      )}
      {message && (
        <p className="rounded-xl bg-emerald-950 p-3 text-sm text-emerald-300">{message}</p>
      )}
      {dbError && (
        <p className="rounded-xl bg-red-950 p-3 text-sm text-red-300">
          Error al cargar el calendario: {dbError.message}
        </p>
      )}

      <NewEventForm defaultDate={defaultDate} returnTo={returnTo} />

      {isMonth ? (
        <>
          {/* Grilla mensual */}
          <section className="rounded-2xl bg-neutral-900 p-3" aria-label={monthLabel(ym)}>
            <div className="mb-1 grid grid-cols-7 text-center text-xs font-medium text-neutral-500">
              {WEEKDAYS.map((w, i) => (
                <span key={i}>{w}</span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {days.map((day) => {
                const inMonth = day.slice(0, 7) === ym
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
                  <Link
                    key={day}
                    href={`/calendario?vista=mes&mes=${day.slice(0, 7)}&dia=${day}`}
                    aria-label={dayLabel(day)}
                    aria-current={isSelected ? 'date' : undefined}
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
                  </Link>
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
            returnTo={returnTo}
          />
        </>
      ) : (
        days.map((day) => (
          <DayBlock
            key={day}
            day={day}
            today={today}
            events={byDay.get(day) ?? []}
            comps={compsByDay.get(day) ?? []}
            doneByEvent={doneByEvent}
            returnTo={returnTo}
          />
        ))
      )}
    </div>
  )
}

export default function CalendarioPage({ searchParams }: { searchParams: Params }) {
  return (
    <main className="app-main">
      <div className="mx-auto max-w-md space-y-4">
        <h1 className="font-display text-4xl font-bold">Calendario</h1>

        <Suspense fallback={<p className="text-neutral-400">Cargando…</p>}>
          <CalendarContent searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  )
}
