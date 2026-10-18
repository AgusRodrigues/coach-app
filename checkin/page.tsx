import { Suspense } from 'react'
import Link from 'next/link'
import { connection } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { dayLabel, todayISO } from '@/lib/dates'
import { saveCheckin } from './actions'

type Search = Promise<{ error?: string }>

const inputClass =
  'w-full rounded-lg border border-neutral-700 bg-neutral-800 p-3 text-neutral-100'

const choiceClass =
  'flex items-center justify-center rounded-lg border border-neutral-700 bg-neutral-800 ' +
  'peer-checked:border-brand peer-checked:bg-brand peer-checked:text-on-brand ' +
  'peer-focus-visible:ring-2 peer-focus-visible:ring-brand ' +
  'transition-colors duration-150'

// Escala de 1 a 5 con botones grandes (un toque)
function Scale({
  name,
  legend,
  low,
  high,
  defaultValue,
}: {
  name: string
  legend: string
  low: string
  high: string
  defaultValue: number | null
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="cursor-pointer">
            <input
              type="radio"
              name={name}
              value={n}
              required
              defaultChecked={defaultValue === n}
              className="peer sr-only"
            />
            <span className={`${choiceClass} h-12 text-lg`}>{n}</span>
          </label>
        ))}
      </div>
      <p className="flex justify-between text-xs text-neutral-500">
        <span>1 = {low}</span>
        <span>5 = {high}</span>
      </p>
    </fieldset>
  )
}

// Todo lo que lee sesion o datos va dentro de Suspense, y empieza con connection()
async function CheckinForm({ searchParams }: { searchParams: Search }) {
  await connection()

  const { error } = await searchParams
  const today = todayISO()

  const supabase = await createClient()
  const { data: row } = await supabase
    .from('daily_checkins')
    .select('sleep_hours, sleep_quality, energy, soreness, notes')
    .eq('checkin_date', today)
    .maybeSingle()

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm capitalize text-neutral-400">{dayLabel(today)}</p>
        {row && (
          <p className="text-sm text-emerald-400">
            Ya hiciste el check-in de hoy. Podés corregirlo.
          </p>
        )}
      </div>

      {error && (
        <p className="rounded-lg bg-red-950 p-3 text-sm text-red-300">{error}</p>
      )}

      <form action={saveCheckin} className="space-y-6">
        <label className="block space-y-1">
          <span className="text-sm font-medium">¿Cuántas horas dormiste?</span>
          <input
            type="number"
            inputMode="decimal"
            name="sleep_hours"
            min="0"
            max="24"
            step="0.5"
            required
            placeholder="7.5"
            defaultValue={row?.sleep_hours ?? ''}
            className={inputClass}
          />
        </label>

        <Scale
          name="sleep_quality"
          legend="¿Cómo dormiste?"
          low="mal"
          high="excelente"
          defaultValue={row?.sleep_quality ?? null}
        />

        <Scale
          name="energy"
          legend="¿Con cuánta energía te levantaste?"
          low="sin energía"
          high="con mucha energía"
          defaultValue={row?.energy ?? null}
        />

        <Scale
          name="soreness"
          legend="¿Cuánto dolor muscular tenés?"
          low="nada"
          high="mucho"
          defaultValue={row?.soreness ?? null}
        />

        <textarea
          name="notes"
          rows={2}
          placeholder="Nota (opcional)"
          defaultValue={row?.notes ?? ''}
          className={inputClass}
        />

        <p className="text-xs text-neutral-500">
          Si tenés dolor agudo o una molestia puntual, registrala en la sesión de
          entrenamiento. Si persiste más de unos días, consultá a un profesional.
        </p>

        <button className="w-full rounded-lg bg-brand p-4 text-lg font-medium text-on-brand">
          {row ? 'Actualizar check-in' : 'Guardar check-in'}
        </button>
      </form>
    </div>
  )
}

export default function CheckinPage({ searchParams }: { searchParams: Search }) {
  return (
    <main className="app-main">
      <div className="mx-auto max-w-md space-y-4">
        <Link href="/" className="text-sm text-neutral-400">
          ← Inicio
        </Link>
        <h1 className="font-display text-4xl font-bold">Check-in de la mañana</h1>

        <Suspense fallback={<p className="text-neutral-400">Cargando…</p>}>
          <CheckinForm searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  )
}
