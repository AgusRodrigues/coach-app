import { Suspense } from "react";
import { login, signup } from "./actions";

type Params = Promise<{ error?: string; message?: string }>;

// Lee searchParams dentro de Suspense (requisito de Next.js con Cache Components)
async function Alerts({ searchParams }: { searchParams: Params }) {
  const { error, message } = await searchParams;

  return (
    <>
      {error && (
        <p className="rounded-lg bg-red-950 p-3 text-sm text-red-300">
          {error}
        </p>
      )}
      {message && (
        <p className="rounded-lg bg-emerald-950 p-3 text-sm text-emerald-300">
          {message}
        </p>
      )}
    </>
  );
}

export default function LoginPage({ searchParams }: { searchParams: Params }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 p-4">
      <form className="w-full max-w-sm space-y-4 rounded-2xl bg-neutral-900 p-6 text-neutral-100">
        <h1 className="text-2xl font-semibold">Coach</h1>
        <p className="text-sm text-neutral-400">
          Ingresá o creá tu cuenta para continuar.
        </p>

        <Suspense fallback={null}>
          <Alerts searchParams={searchParams} />
        </Suspense>

        <div className="space-y-1">
          <label htmlFor="email" className="text-sm">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="w-full rounded-lg border border-neutral-700 bg-neutral-800 p-3"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="text-sm">
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={6}
            autoComplete="current-password"
            className="w-full rounded-lg border border-neutral-700 bg-neutral-800 p-3"
          />
        </div>

        <div className="flex gap-3">
          <button
            formAction={login}
            className="flex-1 rounded-lg bg-white p-3 font-medium text-black"
          >
            Ingresar
          </button>
          <button
            formAction={signup}
            className="flex-1 rounded-lg border border-neutral-600 p-3 font-medium"
          >
            Crear cuenta
          </button>
        </div>
      </form>
    </main>
  );
}
