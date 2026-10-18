import { Suspense } from 'react'
import { login, signup } from './actions'

type Params = Promise<{ error?: string; message?: string }>

// Lee searchParams dentro de Suspense (requisito de Next.js con Cache Components)
async function Alerts({ searchParams }: { searchParams: Params }) {
  const { error, message } = await searchParams

  return (
    <>
      {error && (
        <p role="alert" className="rounded-xl bg-red-950 p-3 text-sm text-red-300">
          {error}
        </p>
      )}
      {message && (
        <p className="rounded-xl bg-emerald-950 p-3 text-sm text-emerald-300">{message}</p>
      )}
    </>
  )
}

const inputClass =
  'w-full rounded-xl border border-neutral-700 bg-neutral-800 p-3.5 text-neutral-100'

export default function LoginPage({ searchParams }: { searchParams: Params }) {
  return (
    <main className="flex min-h-screen flex-col bg-neutral-950 text-neutral-100">
      {/* Cabecera: superficie bordo con andariveles */}
      <header className="relative flex flex-1 flex-col justify-end overflow-hidden bg-brand px-6 pb-10 pt-20 text-on-brand">
        <div aria-hidden className="lane-stripes pointer-events-none absolute inset-0" />
        <div className="relative mx-auto w-full max-w-md">
          <h1 className="font-display text-7xl font-bold leading-none">Coach</h1>
          <p className="mt-3 max-w-xs text-lg leading-snug">
            Tu entrenamiento de velocidad, gimnasio y recuperación en un solo lugar.
          </p>
        </div>
      </header>

      <form className="mx-auto w-full max-w-md space-y-4 px-6 pb-10 pt-8">
        <Suspense fallback={null}>
          <Alerts searchParams={searchParams} />
        </Suspense>

        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className={inputClass}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="text-sm font-medium">
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={6}
            autoComplete="current-password"
            className={inputClass}
          />
          <p className="text-xs text-neutral-500">Mínimo 6 caracteres.</p>
        </div>

        <div className="space-y-3 pt-2">
          <button
            formAction={login}
            className="w-full rounded-xl bg-brand p-3.5 text-lg font-semibold text-on-brand"
          >
            Ingresar
          </button>
          <button
            formAction={signup}
            className="w-full rounded-xl border border-neutral-600 p-3.5 font-medium"
          >
            Crear cuenta
          </button>
        </div>
      </form>
    </main>
  )
}
