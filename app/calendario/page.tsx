import { Suspense } from 'react'
import { connection } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import {
  addDays,
  addMonths,
  isValidISO,
  isValidMonth,
  isoDateInTZ,
  mondayOf,
  monthGrid,
  todayISO,
} from '@/lib/dates'
import { MONTHS_AROUND } from '@/lib/calendar-window'
import { timed } from '@/lib/timing'
import type { CalComp, CalEvent } from './parts'
import CalendarClient, { type CalEventDay } from './CalendarClient'

type Params = Promise<{
  vista?: string
  semana?: string
  mes?: string
  dia?: string
  error?: string
  message?: string
  t?: string
}>

// Todo lo que lee sesion o datos va dentro de Suspense, y empieza con connection()
async function CalendarContent({ searchParams }: { searchParams: Params }) {
  await connection()

  const { vista, semana, mes, dia, error, message, t } = await searchParams
  const today = todayISO()
  const view = vista === 'mes' ? 'mes' : 'semana'

  // ---- Estado inicial segun la direccion ----
  let selected: string
  let viewMonth: string

  if (view === 'mes') {
    const fromDia = dia && isValidISO(dia) ? dia : null
    viewMonth = mes && isValidMonth(mes) ? mes : (fromDia ?? today).slice(0, 7)
    selected =
      fromDia && fromDia.slice(0, 7) === viewMonth
        ? fromDia
        : today.slice(0, 7) === viewMonth
          ? today
          : `${viewMonth}-01`
  } else {
    const monday = mondayOf(semana && isValidISO(semana) ? semana : today)
    selected = today >= monday && today <= addDays(monday, 6) ? today : monday
    viewMonth = selected.slice(0, 7)
  }

  // ---- Ventana de datos: el mes elegido y MONTHS_AROUND meses a cada lado ----
  // Con esto, cambiar de vista, de semana, de mes o de dia no necesita volver al servidor.
  const centerMonth = viewMonth
  const winStart = monthGrid(addMonths(centerMonth, -MONTHS_AROUND))[0]
  const nextGrid = monthGrid(addMonths(centerMonth, MONTHS_AROUND))
  const winEnd = nextGrid[nextGrid.length - 1]
  const from = winStart
  const to = addDays(winEnd, 1)

  // ---- Las tres consultas en paralelo (antes eran una detras de otra) ----
  const supabase = await createClient()

  const debug = process.env.DEBUG_TIMING === '1'

  // Con DEBUG_TIMING=1: una consulta minima de referencia (1 fila de una tabla chica) que sale
  // a la vez que las otras. Dice cuanto cuesta, como minimo, hablar con Supabase.
  const baseline = debug
    ? timed(
        'calendario: referencia (1 fila)',
        supabase.from('body_zones').select('code').limit(1)
      )
    : null

  const [eventsRes, compsRes, logsRes] = await timed(
    'calendario: total',
    Promise.all([
      timed(
        'calendario: eventos',
        supabase
          .from('calendar_events')
          .select('id, kind, title, starts_at, ends_at, is_planned_training, notes, series_id')
          .gte('starts_at', `${from}T00:00:00-03:00`)
          .lt('starts_at', `${to}T00:00:00-03:00`)
          .order('starts_at')
      ),
      timed(
        'calendario: competencias',
        supabase
          .from('competitions')
          .select('id, name, discipline, importance, event_date')
          .gte('event_date', from)
          .lt('event_date', to)
          .order('event_date')
      ),
      // Las sesiones guardan la hora de inicio del evento: se buscan por fecha, sin depender
      // de la consulta de eventos
      timed(
        'calendario: sesiones',
        supabase
          .from('session_logs')
          .select('event_id, rpe')
          .not('event_id', 'is', null)
          .gte('started_at', `${from}T00:00:00-03:00`)
          .lt('started_at', `${to}T00:00:00-03:00`)
      ),
    ])
  )

  if (baseline) {
    await baseline
    console.log(
      `[timing] filas: eventos ${eventsRes.data?.length ?? 0}, competencias ${compsRes.data?.length ?? 0}, sesiones ${logsRes.data?.length ?? 0}`
    )
  }

  const events: CalEventDay[] = ((eventsRes.data ?? []) as CalEvent[]).map((ev) => ({
    ...ev,
    day: isoDateInTZ(ev.starts_at),
  }))
  const comps = (compsRes.data ?? []) as CalComp[]
  const doneEntries: [string, number | null][] = (
    (logsRes.data ?? []) as { event_id: string | null; rpe: number | null }[]
  )
    .filter((l) => l.event_id !== null)
    .map((l) => [l.event_id as string, l.rpe])

  return (
    <>
      {eventsRes.error && (
        <p className="mb-4 rounded-xl bg-red-950 p-3 text-sm text-red-300">
          Error al cargar el calendario: {eventsRes.error.message}
        </p>
      )}

      {/* La clave hace que, al navegar a otro tramo desde el servidor, el componente
          arranque de cero con los datos nuevos */}
      <CalendarClient
        key={`${centerMonth}|${view}|${selected}|${t ?? ''}`}
        initialView={view}
        initialSelected={selected}
        initialViewMonth={viewMonth}
        centerMonth={centerMonth}
        winStart={winStart}
        winEnd={winEnd}
        today={today}
        events={events}
        comps={comps}
        doneEntries={doneEntries}
        error={error}
        message={message}
      />
    </>
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
