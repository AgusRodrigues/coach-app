import { Suspense } from 'react'
import Link from 'next/link'
import { connection } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { daysBetween, dayLabel, todayISO } from '@/lib/dates'
import { formatCs } from '@/lib/time'
import { countdown, phaseFor } from '@/lib/season'
import { createCompetition, deleteCompetition, saveResult } from './actions'

type Search = Promise<{ error?: string; message?: string }>

type Comp = {
  id: string
  event_date: string
  name: string
  discipline: string
  importance: string
  goal_time_cs: number | null
  result_time_cs: number | null
  wind_ms: number | string | null
  notes: string | null
}

const DISCIPLINE_LABEL: Record<string, string> = {
  '100m': '100 m',
  '200m': '200 m',
  otra: 'Otra prueba',
}

const IMPORTANCE_BADGE: Record<string, string> = {
  A: 'bg-amber-900 text-amber-200',
  B: 'bg-sky-900 text-sky-200',
  C: 'bg-neutral-700 text-neutral-200',
}

const IMPORTANCE_HELP: Record<string, string> = {
  A: 'objetivo principal',
  B: 'importante',
  C: 'preparación o control',
}

const inputClass =
  'w-full rounded-lg border border-neutral-700 bg-neutral-800 p-3 text-neutral-100'

const TIME_PATTERN = '(\\d{1,2}:\\d{2}|\\d{1,3})([.,]\\d{1,3})?'

function windText(w: number | string | null): string | null {
  if (w === null) return null
  const n = Number(w)
  return `${n > 0 ? '+' : ''}${n} m/s`
}

function dateText(iso: string, today: string): string {
  const year = iso.slice(0, 4)
  return year === today.slice(0, 4) ? dayLabel(iso) : `${dayLabel(iso)} ${year}`
}

// Todo lo que lee sesion o datos va dentro de Suspense, y empieza con connection()
async function CompetenciasContent({ searchParams }: { searchParams: Search }) {
  await connection()

  const { error, message } = await searchParams
  const today = todayISO()
  const supabase = await createClient()

  const { data, error: dbError } = await supabase
    .from('competitions')
    .select(
      'id, event_date, name, discipline, importance, goal_time_cs, result_time_cs, wind_ms, notes'
    )
    .order('event_date', { ascending: true })
    .limit(500)

  const all = (data ?? []) as Comp[]

  const upcoming = all.filter((c) => c.event_date > today)
  const pending = all.filter((c) => c.event_date <= today && c.result_time_cs === null)
  const past = all
    .filter((c) => c.event_date <= today && c.result_time_cs !== null)
    .sort((a, b) => b.event_date.localeCompare(a.event_date))

  // Competencia principal: la proxima de importancia A; si no hay, la proxima a secas
  const mainTarget = upcoming.find((c) => c.importance === 'A') ?? upcoming[0] ?? null
  const mainDays = mainTarget ? daysBetween(today, mainTarget.event_date) : 0
  const phase = mainTarget ? phaseFor(mainDays) : null

  // Mejor marca en competencia por prueba (con viento legal: hasta +2,0 m/s)
  const bestByDiscipline = new Map<string, number>()
  for (const c of all) {
    if (c.result_time_cs === null || c.discipline === 'otra') continue
    const w = c.wind_ms === null ? null : Number(c.wind_ms)
    if (w !== null && w > 2) continue
    const best = bestByDiscipline.get(c.discipline)
    if (best === undefined || c.result_time_cs < best) {
      bestByDiscipline.set(c.discipline, c.result_time_cs)
    }
  }

  return (
    <div className="space-y-5">
      {error && (
        <p className="rounded-lg bg-red-950 p-3 text-sm text-red-300">{error}</p>
      )}
      {message && (
        <p className="rounded-lg bg-emerald-950 p-3 text-sm text-emerald-300">
          {message}
        </p>
      )}
      {dbError && (
        <p className="rounded-lg bg-red-950 p-3 text-sm text-red-300">
          Error al cargar las competencias: {dbError.message}
        </p>
      )}

      {/* Fase de la temporada */}
      {mainTarget && phase ? (
        <section className="space-y-2 rounded-xl bg-neutral-900 p-4 ring-1 ring-brand">
          <p className="text-sm text-neutral-400">
            {mainTarget.importance === 'A' ? 'Objetivo principal' : 'Próxima competencia'}
          </p>
          <p className="text-lg font-semibold">{mainTarget.name}</p>
          <p className="text-sm text-neutral-300">
            {dateText(mainTarget.event_date, today)} · {countdown(mainDays)}
          </p>
          <div className="rounded-lg bg-neutral-950 p-3">
            <p className="text-sm font-medium text-brand-fg">
              Fase orientativa: {phase.name}
            </p>
            <p className="text-sm text-neutral-400">{phase.hint}</p>
          </div>
          <p className="text-xs text-neutral-500">
            Es una referencia general según los días que faltan. El plan concreto depende de
            tu entrenador y de cómo vengas.
          </p>
        </section>
      ) : (
        <p className="rounded-xl bg-neutral-900 p-4 text-sm text-neutral-400">
          No tenés competencias próximas cargadas. Al agregar una, la app calcula cuánto
          falta y en qué fase de la temporada estás.
        </p>
      )}

      {/* Resultados pendientes */}
      {pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-medium">Cargá el resultado ({pending.length})</h2>
          {pending.map((c) => (
            <article key={c.id} className="space-y-3 rounded-xl bg-neutral-900 p-4">
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="text-sm capitalize text-neutral-400">
                  {dateText(c.event_date, today)} · {DISCIPLINE_LABEL[c.discipline] ?? c.discipline}
                </p>
                {c.goal_time_cs !== null && (
                  <p className="text-xs text-neutral-500">
                    Objetivo: {formatCs(c.goal_time_cs)} s
                  </p>
                )}
              </div>

              <form action={saveResult} className="space-y-3">
                <input type="hidden" name="id" value={c.id} />
                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1 text-xs text-neutral-400">
                    <span>Tiempo (s)</span>
                    <input
                      name="result"
                      required
                      inputMode="decimal"
                      placeholder="10.85"
                      pattern={TIME_PATTERN}
                      title="Ej: 10.85 o 1:02.30"
                      className={inputClass}
                    />
                  </label>
                  <label className="space-y-1 text-xs text-neutral-400">
                    <span>Viento (m/s)</span>
                    <input
                      type="number"
                      name="wind"
                      inputMode="decimal"
                      step="0.1"
                      min="-10"
                      max="10"
                      placeholder="+1.2"
                      className={inputClass}
                    />
                  </label>
                </div>
                <button className="w-full rounded-lg bg-brand p-3 font-medium text-on-brand">
                  Guardar resultado
                </button>
              </form>

              <form action={deleteCompetition}>
                <input type="hidden" name="id" value={c.id} />
                <button className="text-sm text-red-400">Eliminar (no se corrió)</button>
              </form>
            </article>
          ))}
        </section>
      )}

      {/* Proximas */}
      <section className="space-y-3">
        <h2 className="font-medium">Próximas ({upcoming.length})</h2>

        {upcoming.length === 0 ? (
          <p className="rounded-xl bg-neutral-900 p-4 text-sm text-neutral-500">
            No hay competencias futuras.
          </p>
        ) : (
          upcoming.map((c) => {
            const days = daysBetween(today, c.event_date)
            return (
              <article key={c.id} className="space-y-2 rounded-xl bg-neutral-900 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{c.name}</p>
                    <p className="text-sm capitalize text-neutral-400">
                      {dateText(c.event_date, today)} · {countdown(days)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                      IMPORTANCE_BADGE[c.importance] ?? IMPORTANCE_BADGE.C
                    }`}
                  >
                    {c.importance}
                  </span>
                </div>

                <p className="text-sm text-neutral-400">
                  {DISCIPLINE_LABEL[c.discipline] ?? c.discipline}
                  {c.goal_time_cs !== null && ` · objetivo ${formatCs(c.goal_time_cs)} s`}
                </p>
                {c.notes && <p className="text-sm text-neutral-500">{c.notes}</p>}

                <details className="text-sm">
                  <summary className="cursor-pointer text-neutral-500">Editar</summary>
                  <form action={deleteCompetition} className="mt-2">
                    <input type="hidden" name="id" value={c.id} />
                    <button className="text-red-400">Eliminar competencia</button>
                  </form>
                </details>
              </article>
            )
          })
        )}
      </section>

      {/* Nueva competencia */}
      <details className="rounded-xl bg-neutral-900 p-4">
        <summary className="cursor-pointer font-medium">+ Agregar competencia</summary>

        <form action={createCompetition} className="mt-4 space-y-3">
          <input
            name="name"
            required
            maxLength={80}
            placeholder="Nombre (ej: Torneo Metropolitano)"
            className={inputClass}
          />

          <input type="date" name="date" required className={inputClass} />

          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1 text-xs text-neutral-400">
              <span>Prueba</span>
              <select name="discipline" defaultValue="100m" className={inputClass}>
                {Object.entries(DISCIPLINE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs text-neutral-400">
              <span>Importancia</span>
              <select name="importance" defaultValue="B" className={inputClass}>
                {Object.entries(IMPORTANCE_HELP).map(([value, help]) => (
                  <option key={value} value={value}>
                    {value} · {help}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block space-y-1 text-xs text-neutral-400">
            <span>Tiempo objetivo (s), opcional</span>
            <input
              name="goal"
              inputMode="decimal"
              placeholder="10.85"
              pattern={TIME_PATTERN}
              title="Ej: 10.85 o 22.40"
              className={inputClass}
            />
          </label>

          <textarea
            name="notes"
            rows={2}
            placeholder="Notas (opcional)"
            className={inputClass}
          />

          <p className="text-xs text-neutral-500">
            Podés cargar también competencias pasadas: después se te pide el resultado.
          </p>

          <button className="w-full rounded-lg bg-brand p-3 font-medium text-on-brand">
            Guardar competencia
          </button>
        </form>
      </details>

      {/* Pasadas */}
      {past.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-medium">Resultados</h2>

          {past.map((c) => {
            const result = c.result_time_cs as number
            const wind = c.wind_ms === null ? null : Number(c.wind_ms)
            const illegalWind = wind !== null && wind > 2
            const isBest =
              c.discipline !== 'otra' &&
              !illegalWind &&
              bestByDiscipline.get(c.discipline) === result
            const diff = c.goal_time_cs !== null ? result - c.goal_time_cs : null

            return (
              <article key={c.id} className="space-y-1 rounded-xl bg-neutral-900 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{c.name}</p>
                    <p className="text-sm capitalize text-neutral-400">
                      {dateText(c.event_date, today)} ·{' '}
                      {DISCIPLINE_LABEL[c.discipline] ?? c.discipline}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                      IMPORTANCE_BADGE[c.importance] ?? IMPORTANCE_BADGE.C
                    }`}
                  >
                    {c.importance}
                  </span>
                </div>

                <p className="text-lg font-semibold">
                  {formatCs(result)} s
                  {isBest && (
                    <span className="ml-2 rounded-full bg-amber-900 px-2 py-0.5 text-xs font-normal text-amber-200">
                      🏅 Mejor marca en competencia
                    </span>
                  )}
                </p>

                <p className="text-xs text-neutral-500">
                  {wind !== null && `Viento ${windText(wind)}`}
                  {wind !== null && diff !== null && ' · '}
                  {diff !== null &&
                    (diff === 0
                      ? 'Igualaste tu objetivo'
                      : diff < 0
                        ? `${formatCs(Math.abs(diff))} s mejor que el objetivo`
                        : `${formatCs(diff)} s por encima del objetivo`)}
                </p>

                {illegalWind && (
                  <p className="text-xs text-amber-400">
                    Viento a favor mayor a 2,0 m/s: la marca no sería homologable.
                  </p>
                )}
                {c.notes && <p className="text-sm text-neutral-500">{c.notes}</p>}

                <details className="pt-1 text-sm">
                  <summary className="cursor-pointer text-neutral-500">Editar</summary>
                  <div className="mt-2 space-y-3">
                    <form action={saveResult} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-2">
                      <input type="hidden" name="id" value={c.id} />
                      <label className="space-y-1 text-xs text-neutral-400">
                        <span>Tiempo (s)</span>
                        <input
                          name="result"
                          required
                          inputMode="decimal"
                          defaultValue={formatCs(result)}
                          pattern={TIME_PATTERN}
                          className={inputClass}
                        />
                      </label>
                      <label className="space-y-1 text-xs text-neutral-400">
                        <span>Viento</span>
                        <input
                          type="number"
                          name="wind"
                          inputMode="decimal"
                          step="0.1"
                          min="-10"
                          max="10"
                          defaultValue={wind ?? ''}
                          className={inputClass}
                        />
                      </label>
                      <button className="rounded-lg border border-neutral-600 px-3 py-3">
                        Guardar
                      </button>
                    </form>

                    <form action={deleteCompetition}>
                      <input type="hidden" name="id" value={c.id} />
                      <button className="text-red-400">Eliminar competencia</button>
                    </form>
                  </div>
                </details>
              </article>
            )
          })}
        </section>
      )}
    </div>
  )
}

export default function CompetenciasPage({ searchParams }: { searchParams: Search }) {
  return (
    <main className="app-main">
      <div className="mx-auto max-w-md space-y-4">
        <Link href="/" className="text-sm text-neutral-400">
          ← Inicio
        </Link>
        <h1 className="font-display text-4xl font-bold">Competencias</h1>

        <Suspense fallback={<p className="text-neutral-400">Cargando…</p>}>
          <CompetenciasContent searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  )
}
