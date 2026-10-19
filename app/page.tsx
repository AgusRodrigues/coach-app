import { Suspense } from 'react'
import Link from 'next/link'
import { connection } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { addDays, dayLabel, daysBetween, mondayOf, timeInTZ, todayISO } from '@/lib/dates'
import { formatCs } from '@/lib/time'
import { phaseFor } from '@/lib/season'

type Ev = {
  id: string
  kind: string
  title: string
  starts_at: string
  ends_at: string
  is_planned_training: boolean
}

type Comp = {
  id: string
  name: string
  discipline: string
  importance: string
  event_date: string
  goal_time_cs: number | null
}

const KIND_LABEL: Record<string, string> = {
  track: 'Pista',
  gym: 'Gimnasio',
  daily_life: 'Vida diaria',
  competition: 'Competencia',
  other: 'Otro',
}

const DISCIPLINE: Record<string, string> = {
  '100m': '100 m',
  '200m': '200 m',
  otra: 'Otra prueba',
}

// Todo lo que lee sesion o datos va dentro de Suspense, y empieza con connection()
async function Dashboard() {
  await connection()

  const supabase = await createClient()
  const today = todayISO()
  const monday = mondayOf(today)
  const nextMonday = addDays(monday, 7)

  const [profileRes, todayRes, weekRes, checkinRes, painRes, compRes, logsRes] =
    await Promise.all([
    supabase.from('profiles').select('display_name').maybeSingle(),
    supabase
      .from('calendar_events')
      .select('id, kind, title, starts_at, ends_at, is_planned_training')
      .gte('starts_at', `${today}T00:00:00-03:00`)
      .lt('starts_at', `${addDays(today, 1)}T00:00:00-03:00`)
      .order('starts_at'),
    supabase
      .from('calendar_events')
      .select('id')
      .eq('is_planned_training', true)
      .gte('starts_at', `${monday}T00:00:00-03:00`)
      .lt('starts_at', `${nextMonday}T00:00:00-03:00`),
    supabase.from('daily_checkins').select('id').eq('checkin_date', today).maybeSingle(),
    supabase
      .from('pain_reports')
      .select('id', { count: 'exact', head: true })
      .is('resolved_on', null),
    supabase
      .from('competitions')
      .select('id, name, discipline, importance, event_date, goal_time_cs')
      .gte('event_date', today)
      .order('event_date')
      .limit(20),
    // Sesiones registradas esta semana (incluye las de hoy). Se buscan por fecha para no
    // tener que esperar a la consulta de eventos.
    supabase
      .from('session_logs')
      .select('event_id')
      .not('event_id', 'is', null)
      .gte('started_at', `${monday}T00:00:00-03:00`)
      .lt('started_at', `${nextMonday}T00:00:00-03:00`),
  ])

  const name = (profileRes.data as { display_name: string | null } | null)?.display_name
    ?.trim()
    .split(/\s+/)[0]

  const todayEvents = (todayRes.data ?? []) as Ev[]
  const weekIds = ((weekRes.data ?? []) as { id: string }[]).map((e) => e.id)

  // Sesiones ya registradas (de hoy y de la semana)
  const doneIds = new Set<string>()
  for (const l of (logsRes.data ?? []) as { event_id: string | null }[]) {
    if (l.event_id) doneIds.add(l.event_id)
  }

  const plannedTotal = weekIds.length
  const plannedDone = weekIds.filter((id) => doneIds.has(id)).length
  const pct = plannedTotal === 0 ? 0 : Math.round((plannedDone / plannedTotal) * 100)

  const comps = (compRes.data ?? []) as Comp[]
  const target = comps.find((c) => c.importance === 'A') ?? comps[0] ?? null
  const targetDays = target ? daysBetween(today, target.event_date) : 0
  const phase = target ? phaseFor(targetDays) : null

  const hasCheckin = !!checkinRes.data
  const painCount = painRes.count ?? 0

  return (
    <div className="space-y-6">
      {/* Saludo */}
      <header>
        <p className="text-sm capitalize text-neutral-400">{dayLabel(today)}</p>
        <h1 className="font-display text-5xl font-bold leading-none">
          {name ? `Hola, ${name}` : 'Hola'}
        </h1>
      </header>

      {/* Objetivo principal: lo mas memorable de la app */}
      {target && phase ? (
        <Link
          href="/competencias"
          className="relative block overflow-hidden rounded-3xl bg-brand p-5 text-on-brand"
        >
          <div aria-hidden className="lane-stripes pointer-events-none absolute inset-0" />
          <div className="relative">
            <p className="text-sm opacity-90">
              {target.importance === 'A' ? 'Tu objetivo principal' : 'Próxima competencia'}
            </p>

            <div className="mt-1 flex items-end gap-3">
              {targetDays === 0 ? (
                <span className="font-display text-7xl font-bold leading-none">Hoy</span>
              ) : (
                <>
                  <span className="font-display text-8xl font-bold leading-[0.85]">
                    {targetDays}
                  </span>
                  <span className="pb-1 text-xl font-medium">
                    {targetDays === 1 ? 'día' : 'días'}
                  </span>
                </>
              )}
            </div>

            <p className="mt-4 text-lg font-semibold leading-tight">{target.name}</p>
            <p className="text-sm capitalize opacity-90">
              {DISCIPLINE[target.discipline] ?? target.discipline}, {dayLabel(target.event_date)}
            </p>

            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              <span className="rounded-full bg-black/30 px-3 py-1">{phase.name}</span>
              {target.goal_time_cs !== null && (
                <span className="rounded-full bg-black/30 px-3 py-1">
                  Objetivo {formatCs(target.goal_time_cs)} s
                </span>
              )}
            </div>
          </div>
        </Link>
      ) : (
        <Link
          href="/competencias"
          className="block rounded-3xl border border-dashed border-neutral-600 p-5"
        >
          <p className="font-display text-2xl font-semibold">Cargá tu próxima competencia</p>
          <p className="mt-1 text-sm text-neutral-400">
            La app cuenta los días que faltan y te dice en qué fase de la temporada estás.
          </p>
        </Link>
      )}

      {/* Hoy */}
      <section className="space-y-3">
        <h2 className="font-display text-3xl font-semibold leading-none">Hoy</h2>

        {todayEvents.length === 0 ? (
          <Link
            href="/calendario"
            className="block rounded-2xl bg-neutral-900 p-4 text-sm text-neutral-400"
          >
            No hay nada cargado para hoy.{' '}
            <span className="font-medium text-brand-fg">Agregar al calendario</span>
          </Link>
        ) : (
          <ul className="space-y-2">
            {todayEvents.map((ev) => {
              const done = doneIds.has(ev.id)
              return (
                <li
                  key={ev.id}
                  className={`flex items-center justify-between gap-3 rounded-2xl bg-neutral-900 p-4 ${
                    ev.is_planned_training ? 'border-l-4 border-brand' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-xs text-neutral-400">
                      {timeInTZ(ev.starts_at)} a {timeInTZ(ev.ends_at)}
                    </p>
                    <p className="truncate font-semibold">{ev.title}</p>
                    <p className="text-xs text-neutral-500">{KIND_LABEL[ev.kind] ?? 'Otro'}</p>
                  </div>

                  {ev.is_planned_training &&
                    (done ? (
                      <span className="shrink-0 text-sm font-medium text-emerald-300">
                        ✓ Registrada
                      </span>
                    ) : (
                      <Link
                        href={`/sesion/${ev.id}`}
                        className="shrink-0 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-on-brand"
                      >
                        Terminé
                      </Link>
                    ))}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Check-in */}
      {hasCheckin ? (
        <Link
          href="/checkin"
          className="flex items-center justify-between rounded-2xl bg-neutral-900 p-4 text-sm"
        >
          <span className="font-medium text-emerald-300">✓ Check-in de hoy hecho</span>
          <span className="text-neutral-400">Editar</span>
        </Link>
      ) : (
        <Link
          href="/checkin"
          className="flex items-center justify-between gap-3 rounded-2xl border border-brand bg-brand-soft p-4"
        >
          <div>
            <p className="font-semibold">Check-in de la mañana</p>
            <p className="text-sm text-neutral-400">Sueño, energía y dolor muscular. Son 10 segundos.</p>
          </div>
          <span className="shrink-0 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-on-brand">
            Hacer
          </span>
        </Link>
      )}

      {/* Molestias activas */}
      {painCount > 0 && (
        <Link
          href="/molestias"
          className="block rounded-2xl bg-amber-950/60 p-4 ring-1 ring-amber-700"
        >
          <p className="font-semibold text-amber-300">
            {painCount === 1 ? '1 molestia activa' : `${painCount} molestias activas`}
          </p>
          <p className="text-sm text-neutral-400">
            Revisalas antes de entrenar. Si empeoran o duran más de unos días, consultá a un
            profesional.
          </p>
        </Link>
      )}

      {/* Avance de la semana */}
      <section className="space-y-3 rounded-2xl bg-neutral-900 p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-2xl font-semibold leading-none">Esta semana</h2>
          {plannedTotal > 0 && (
            <p className="text-sm text-neutral-400">
              {plannedDone} de {plannedTotal} {plannedTotal === 1 ? 'sesión' : 'sesiones'}
            </p>
          )}
        </div>

        {plannedTotal === 0 ? (
          <p className="text-sm text-neutral-400">
            No planificaste entrenamientos esta semana.{' '}
            <Link href="/calendario" className="font-medium text-brand-fg">
              Armar la semana
            </Link>
          </p>
        ) : (
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            aria-label="Sesiones completadas esta semana"
            className="h-2.5 overflow-hidden rounded-full bg-neutral-800"
          >
            <div className="bar-grow h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
          </div>
        )}
      </section>
    </div>
  )
}

export default function Home() {
  return (
    <main className="app-main">
      <div className="mx-auto max-w-md">
        <Suspense fallback={<p className="text-neutral-400">Cargando…</p>}>
          <Dashboard />
        </Suspense>
      </div>
    </main>
  )
}
