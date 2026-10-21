import { Suspense } from 'react'
import Link from 'next/link'
import { connection } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { timed } from '@/lib/timing'
import { saveProfile } from './actions'

type Params = Promise<{ error?: string; message?: string }>

const inputClass =
  'w-full rounded-lg border border-neutral-700 bg-neutral-800 p-3 text-neutral-100'

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm">{label}</span>
      {children}
      {hint && <span className="block text-xs text-neutral-500">{hint}</span>}
    </label>
  )
}

// Todo lo que lee sesion o datos va dentro de Suspense, y empieza con connection()
async function ProfileForm({ searchParams }: { searchParams: Params }) {
  await connection()

  const { error, message } = await searchParams
  const supabase = await createClient()

  // Las dos consultas salen juntas (antes la segunda esperaba a la primera)
  const [profileRes, measurementRes] = await timed(
    'perfil: 2 consultas',
    Promise.all([
      supabase.from('profiles').select('*').maybeSingle(),
      supabase
        .from('body_measurements')
        .select('weight_kg')
        .not('weight_kg', 'is', null)
        .order('measured_on', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])
  )
  const profile = profileRes.data
  const lastMeasurement = measurementRes.data

  const lastWeight = lastMeasurement?.weight_kg ?? ''

  return (
    <form action={saveProfile} className="space-y-4">
      {error && (
        <p className="rounded-lg bg-red-950 p-3 text-sm text-red-300">{error}</p>
      )}
      {message && (
        <p className="rounded-lg bg-emerald-950 p-3 text-sm text-emerald-300">
          {message}
        </p>
      )}

      <input type="hidden" name="last_weight" value={lastWeight} />

      <Field label="Nombre">
        <input
          name="display_name"
          defaultValue={profile?.display_name ?? ''}
          className={inputClass}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Fecha de nacimiento">
          <input
            type="date"
            name="birth_date"
            defaultValue={profile?.birth_date ?? ''}
            className={inputClass}
          />
        </Field>
        <Field label="Sexo">
          <select
            name="sex"
            defaultValue={profile?.sex ?? ''}
            className={inputClass}
          >
            <option value="">—</option>
            <option value="M">Masculino</option>
            <option value="F">Femenino</option>
            <option value="X">Otro</option>
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Altura (cm)">
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            min="100"
            max="250"
            name="height_cm"
            defaultValue={profile?.height_cm ?? ''}
            className={inputClass}
          />
        </Field>
        <Field label="Peso actual (kg)" hint="Se guarda con la fecha de hoy.">
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            min="20"
            max="300"
            name="weight_kg"
            defaultValue={lastWeight}
            className={inputClass}
          />
        </Field>
      </div>

      <Field
        label="Horas semanales disponibles para entrenar"
        hint="Tiempo real, contando pista y gimnasio."
      >
        <input
          type="number"
          inputMode="decimal"
          step="0.5"
          min="0"
          name="weekly_hours"
          defaultValue={profile?.weekly_hours ?? ''}
          className={inputClass}
        />
      </Field>

      <Field label="Objetivo a 3 meses">
        <textarea
          name="goal_3m"
          rows={2}
          defaultValue={profile?.goal_3m ?? ''}
          className={inputClass}
        />
      </Field>

      <Field label="Objetivo a 12 meses">
        <textarea
          name="goal_12m"
          rows={2}
          defaultValue={profile?.goal_12m ?? ''}
          className={inputClass}
        />
      </Field>

      <label className="flex items-start gap-3 text-sm text-neutral-300">
        <input
          type="checkbox"
          name="consent"
          defaultChecked={!!profile?.consent_at}
          disabled={!!profile?.consent_at}
          className="mt-1"
        />
        <span>
          Acepto que la app guarde mis datos de entrenamiento y salud para
          mostrarme mi progreso. Es una herramienta de apoyo, no reemplaza a un
          médico ni a un entrenador.
        </span>
      </label>

      <button className="w-full rounded-lg bg-brand p-3 font-medium text-on-brand">
        Guardar ficha
      </button>
    </form>
  )
}

export default function PerfilPage({ searchParams }: { searchParams: Params }) {
  return (
    <main className="app-main">
      <div className="mx-auto max-w-md space-y-4">
        <Link href="/" className="text-sm text-neutral-400">
          ← Inicio
        </Link>
        <h1 className="font-display text-4xl font-bold">Mi ficha</h1>

        <Suspense fallback={<p className="text-neutral-400">Cargando…</p>}>
          <ProfileForm searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  )
}
