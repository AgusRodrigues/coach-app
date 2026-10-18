'use client'

import { useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { addDays, shortDate } from '@/lib/dates'
import { formatCs } from '@/lib/time'
import type { ProgressData, StrengthPoint, TrackPoint } from '@/lib/progress'

type RangeKey = '3m' | '6m' | '1y' | 'all'

const RANGES: { key: RangeKey; label: string; days: number | null }[] = [
  { key: '3m', label: '3 meses', days: 90 },
  { key: '6m', label: '6 meses', days: 180 },
  { key: '1y', label: '1 año', days: 365 },
  { key: 'all', label: 'Todo', days: null },
]

const GRID = 'var(--border)'
const AXIS = 'var(--fg-muted)'
const tickStyle = { fill: AXIS, fontSize: 11 }
const tooltipStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--border-strong)',
  borderRadius: 8,
}

// Fecha ISO -> numero (para usar un eje de tiempo real, con huecos proporcionales)
const ts = (iso: string) => Date.parse(`${iso}T12:00:00Z`)
const isoOf = (t: number) => new Date(t).toISOString().slice(0, 10)
const tickDate = (t: number) => shortDate(isoOf(t))

const selectClass =
  'w-full rounded-lg border border-neutral-700 bg-neutral-800 p-3 text-neutral-100'

function Card({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3 rounded-xl bg-neutral-900 p-4">
      <div>
        <h2 className="font-medium">{title}</h2>
        {subtitle && <p className="text-xs text-neutral-500">{subtitle}</p>}
      </div>
      {children}
    </section>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-lg bg-neutral-950 p-4 text-sm text-neutral-500">{text}</p>
}

// Contenedor con altura fija en pixeles: no depende de clases ni de porcentajes,
// que fallan en silencio cuando el padre mide 0.
function ChartBox({
  height,
  children,
}: {
  height: number
  children: React.ReactElement
}) {
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height={height}>
        {children}
      </ResponsiveContainer>
    </div>
  )
}

function TrackTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: ReadonlyArray<{ payload?: { date: string; cs: number; wind: number | null } }>
}) {
  const p = payload?.[0]?.payload
  if (!active || !p) return null
  return (
    <div className="rounded-lg border border-neutral-700 bg-neutral-900 p-2 text-xs text-neutral-100">
      <p className="font-medium">{shortDate(p.date)}</p>
      <p>{formatCs(p.cs)} s</p>
      {p.wind !== null && (
        <p className="text-neutral-400">
          Viento {p.wind > 0 ? '+' : ''}
          {p.wind} m/s
        </p>
      )}
    </div>
  )
}

function TrackCard({
  track,
  cutoff,
}: {
  track: ProgressData['track']
  cutoff: string | null
}) {
  const [selected, setSelected] = useState<number | null>(null)

  if (track.length === 0) {
    return (
      <Card title="Tiempos de pista">
        <Empty text="Todavía no cargaste repeticiones de pista." />
      </Card>
    )
  }

  const current = track.find((t) => t.distance === selected) ?? track[0]
  const all: TrackPoint[] = current.points
  const visible = all.filter((p) => cutoff === null || p.date >= cutoff)

  // Mejor marca de toda la historia (no depende del periodo elegido)
  const best = all.reduce((b, p) => (p.cs < b.cs ? p : b), all[0])
  const windy = best.wind !== null && best.wind > 2

  const data = visible.map((p) => ({ t: ts(p.date), seconds: p.cs / 100, ...p }))

  return (
    <Card
      title="Tiempos de pista"
      subtitle="Mejor repetición de cada día. Más bajo es mejor."
    >
      <div className="flex flex-wrap gap-2">
        {track.map((t) => (
          <button
            key={t.distance}
            type="button"
            aria-pressed={t.distance === current.distance}
            onClick={() => setSelected(t.distance)}
            className={`rounded-full border px-4 py-1.5 text-sm ${
              t.distance === current.distance
                ? 'border-brand bg-brand text-on-brand'
                : 'border-neutral-600 text-neutral-200'
            }`}
          >
            {t.distance} m
          </button>
        ))}
      </div>

      <p className="text-sm text-neutral-300">
        Mejor marca:{' '}
        <span className="font-semibold text-white">{formatCs(best.cs)} s</span>{' '}
        <span className="text-neutral-500">({shortDate(best.date)})</span>
        {best.wind !== null && (
          <span className="text-neutral-500">
            {' '}
            · viento {best.wind > 0 ? '+' : ''}
            {best.wind} m/s
          </span>
        )}
      </p>
      {windy && (
        <p className="text-xs text-amber-400">
          Esa marca tuvo viento a favor mayor a 2,0 m/s, así que no sería homologable.
        </p>
      )}

      {data.length === 0 ? (
        <Empty text="Sin datos en este período." />
      ) : (
        <ChartBox height={224}>
            <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis
                dataKey="t"
                type="number"
                scale="time"
                domain={['dataMin', 'dataMax']}
                tickFormatter={tickDate}
                tick={tickStyle}
                stroke={AXIS}
              />
              <YAxis
                domain={['auto', 'auto']}
                tickFormatter={(v: number) => v.toFixed(2)}
                tick={tickStyle}
                stroke={AXIS}
                width={52}
              />
              <Tooltip content={<TrackTooltip />} />
              <Line
                type="monotone"
                dataKey="seconds"
                stroke="var(--brand-fg)"
                strokeWidth={2}
                dot={{ r: 3 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ChartBox>
      )}
    </Card>
  )
}

function LoadCard({
  weeklyLoad,
  cutoff,
}: {
  weeklyLoad: ProgressData['weeklyLoad']
  cutoff: string | null
}) {
  // Una semana entra si su ultimo dia cae dentro del periodo
  const visible = weeklyLoad.filter((w) => cutoff === null || addDays(w.week, 6) >= cutoff)
  const data = visible.map((w) => ({
    label: shortDate(w.week),
    load: w.load,
    sessions: w.sessions,
  }))

  return (
    <Card
      title="Carga semanal"
      subtitle="Esfuerzo (RPE) × minutos, sumado por semana. Cada barra es una semana."
    >
      {data.length === 0 ? (
        <Empty text="Todavía no hay sesiones registradas en este período." />
      ) : (
        <ChartBox height={224}>
            <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis
                dataKey="label"
                tick={tickStyle}
                stroke={AXIS}
                interval="preserveStartEnd"
              />
              <YAxis tick={tickStyle} stroke={AXIS} width={44} />
              <Tooltip
                contentStyle={tooltipStyle}
                labelStyle={{ color: 'var(--fg)' }}
                labelFormatter={(l) => `Semana del ${String(l)}`}
                formatter={(value, _name, item) => {
                  const sessions = (item?.payload as { sessions?: number } | undefined)
                    ?.sessions
                  return [
                    `${Number(value)} UA${sessions != null ? ` · ${sessions} ses.` : ''}`,
                    'Carga',
                  ]
                }}
              />
              <Bar dataKey="load" fill="var(--brand)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ChartBox>
      )}
    </Card>
  )
}

function StrengthCard({
  strength,
  cutoff,
}: {
  strength: ProgressData['strength']
  cutoff: string | null
}) {
  const [selected, setSelected] = useState<string | null>(null)

  if (strength.length === 0) {
    return (
      <Card title="Fuerza en el gimnasio">
        <Empty text="Todavía no cargaste ejercicios con peso." />
      </Card>
    )
  }

  const current = strength.find((s) => s.id === selected) ?? strength[0]
  const points: StrengthPoint[] = current.points.filter(
    (p) => cutoff === null || p.date >= cutoff
  )
  const data = points.map((p) => ({ t: ts(p.date), kg: p.load, ...p }))

  return (
    <Card
      title="Fuerza en el gimnasio"
      subtitle="Mayor carga que usaste cada día en el ejercicio elegido."
    >
      <select
        value={current.id}
        onChange={(e) => setSelected(e.target.value)}
        aria-label="Ejercicio"
        className={selectClass}
      >
        {strength.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>

      {data.length === 0 ? (
        <Empty text="Sin datos de este ejercicio en el período." />
      ) : (
        <ChartBox height={224}>
            <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis
                dataKey="t"
                type="number"
                scale="time"
                domain={['dataMin', 'dataMax']}
                tickFormatter={tickDate}
                tick={tickStyle}
                stroke={AXIS}
              />
              <YAxis domain={['auto', 'auto']} tick={tickStyle} stroke={AXIS} width={44} />
              <Tooltip
                contentStyle={tooltipStyle}
                labelStyle={{ color: 'var(--fg)' }}
                labelFormatter={(t) => tickDate(Number(t))}
                formatter={(value, _name, item) => {
                  const reps = (item?.payload as { reps?: number } | undefined)?.reps
                  return [`${Number(value)} kg${reps != null ? ` × ${reps}` : ''}`, 'Carga']
                }}
              />
              <Line
                type="monotone"
                dataKey="kg"
                stroke="var(--gold)"
                strokeWidth={2}
                dot={{ r: 3 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ChartBox>
      )}
    </Card>
  )
}

function RecoveryCard({
  checkins,
  cutoff,
}: {
  checkins: ProgressData['checkins']
  cutoff: string | null
}) {
  const visible = checkins.filter((c) => cutoff === null || c.date >= cutoff)
  const data = visible.map((c) => ({ t: ts(c.date), ...c }))

  if (data.length === 0) {
    return (
      <Card title="Sueño y recuperación">
        <Empty text="Todavía no hay check-ins en este período." />
      </Card>
    )
  }

  return (
    <Card
      title="Sueño y recuperación"
      subtitle="Horas de sueño, y energía y dolor muscular (escala de 1 a 5)."
    >
      <div>
        <p className="mb-1 text-xs text-neutral-400">Horas de sueño</p>
        <ChartBox height={160}>
            <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis
                dataKey="t"
                type="number"
                scale="time"
                domain={['dataMin', 'dataMax']}
                tickFormatter={tickDate}
                tick={tickStyle}
                stroke={AXIS}
              />
              <YAxis domain={[0, 12]} tick={tickStyle} stroke={AXIS} width={44} />
              <Tooltip
                contentStyle={tooltipStyle}
                labelStyle={{ color: 'var(--fg)' }}
                labelFormatter={(t) => tickDate(Number(t))}
                formatter={(value) => [`${Number(value)} h`, 'Sueño']}
              />
              <Line
                type="monotone"
                dataKey="sleep"
                stroke="var(--fg)"
                strokeWidth={2}
                dot={{ r: 2 }}
                connectNulls
                isAnimationActive={false}
              />
            </LineChart>
          </ChartBox>
      </div>

      <div>
        <p className="mb-1 text-xs text-neutral-400">
          <span className="text-brand-fg">● Energía</span> (5 = mucha) ·{' '}
          <span className="text-gold">● Dolor muscular</span> (5 = mucho)
        </p>
        <ChartBox height={160}>
            <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis
                dataKey="t"
                type="number"
                scale="time"
                domain={['dataMin', 'dataMax']}
                tickFormatter={tickDate}
                tick={tickStyle}
                stroke={AXIS}
              />
              <YAxis
                domain={[1, 5]}
                ticks={[1, 2, 3, 4, 5]}
                tick={tickStyle}
                stroke={AXIS}
                width={44}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelStyle={{ color: 'var(--fg)' }}
                labelFormatter={(t) => tickDate(Number(t))}
              />
              <Line
                type="monotone"
                dataKey="energy"
                name="Energía"
                stroke="var(--brand-fg)"
                strokeWidth={2}
                dot={{ r: 2 }}
                connectNulls
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="soreness"
                name="Dolor muscular"
                stroke="var(--gold)"
                strokeWidth={2}
                dot={{ r: 2 }}
                connectNulls
                isAnimationActive={false}
              />
            </LineChart>
          </ChartBox>
      </div>
    </Card>
  )
}

function WeightCard({
  weight,
  cutoff,
}: {
  weight: ProgressData['weight']
  cutoff: string | null
}) {
  const visible = weight.filter((w) => cutoff === null || w.date >= cutoff)
  const data = visible.map((w) => ({ t: ts(w.date), kg: w.kg }))

  return (
    <Card title="Peso corporal">
      {data.length === 0 ? (
        <Empty text="Todavía no hay mediciones de peso en este período. Cargalas desde Mi ficha." />
      ) : (
        <ChartBox height={192}>
            <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis
                dataKey="t"
                type="number"
                scale="time"
                domain={['dataMin', 'dataMax']}
                tickFormatter={tickDate}
                tick={tickStyle}
                stroke={AXIS}
              />
              <YAxis domain={['auto', 'auto']} tick={tickStyle} stroke={AXIS} width={44} />
              <Tooltip
                contentStyle={tooltipStyle}
                labelStyle={{ color: 'var(--fg)' }}
                labelFormatter={(t) => tickDate(Number(t))}
                formatter={(value) => [`${Number(value)} kg`, 'Peso']}
              />
              <Line
                type="monotone"
                dataKey="kg"
                stroke="var(--fg)"
                strokeWidth={2}
                dot={{ r: 3 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ChartBox>
      )}
    </Card>
  )
}

// "today" viene del servidor: asi el componente no necesita leer el reloj al renderizar
export default function ProgressCharts({
  data,
  today,
}: {
  data: ProgressData
  today: string
}) {
  const [range, setRange] = useState<RangeKey>('6m')

  const days = RANGES.find((r) => r.key === range)?.days ?? null
  const cutoff = days === null ? null : addDays(today, -days)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Período">
        {RANGES.map((r) => (
          <button
            key={r.key}
            type="button"
            aria-pressed={range === r.key}
            onClick={() => setRange(r.key)}
            className={`rounded-full border px-4 py-1.5 text-sm ${
              range === r.key
                ? 'border-brand bg-brand text-on-brand'
                : 'border-neutral-600 text-neutral-200'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <TrackCard track={data.track} cutoff={cutoff} />
      <LoadCard weeklyLoad={data.weeklyLoad} cutoff={cutoff} />
      <StrengthCard strength={data.strength} cutoff={cutoff} />
      <RecoveryCard checkins={data.checkins} cutoff={cutoff} />
      <WeightCard weight={data.weight} cutoff={cutoff} />
    </div>
  )
}
