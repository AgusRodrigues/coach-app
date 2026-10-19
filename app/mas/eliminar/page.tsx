import { Suspense } from 'react'
import Link from 'next/link'
import { connection } from 'next/server'
import { deleteAccount } from './actions'

type Search = Promise<{ error?: string }>

// Todo lo que lee datos de la peticion va dentro de Suspense, y empieza con connection()
async function DeleteForm({ searchParams }: { searchParams: Search }) {
  await connection()
  const { error } = await searchParams

  return (
    <div className="space-y-5">
      {error && (
        <p role="alert" className="rounded-xl bg-red-950 p-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <section className="space-y-3 rounded-2xl bg-neutral-900 p-4">
        <p className="font-semibold">Se va a borrar todo, y no se puede deshacer.</p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-300">
          <li>Tu ficha, tu peso y tus objetivos.</li>
          <li>Todas tus sesiones, tiempos de pista, ejercicios y series.</li>
          <li>Tus molestias, check-ins, competencias y el calendario.</li>
          <li>Tu cuenta: vas a tener que crear una nueva para volver a usar la app.</li>
        </ul>
        <p className="text-sm text-neutral-400">
          Si querés conservar una copia, descargala antes desde{' '}
          <Link href="/mas" className="font-medium text-brand-fg underline">
            Más
          </Link>
          , con «Descargar mis datos».
        </p>
      </section>

      <form action={deleteAccount} className="space-y-3">
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">Para confirmar, escribí ELIMINAR</span>
          <input
            name="confirm"
            required
            autoComplete="off"
            autoCapitalize="characters"
            placeholder="ELIMINAR"
            className="w-full rounded-xl border border-neutral-700 bg-neutral-800 p-3.5 text-neutral-100"
          />
        </label>

        <button className="w-full rounded-xl bg-red-950 p-3.5 font-semibold text-red-300 ring-1 ring-red-400">
          Eliminar mi cuenta y mis datos
        </button>
      </form>

      <Link href="/mas" className="block text-center text-sm text-neutral-400">
        Cancelar, no quiero eliminarla
      </Link>
    </div>
  )
}

export default function EliminarPage({ searchParams }: { searchParams: Search }) {
  return (
    <main className="app-main">
      <div className="mx-auto max-w-md space-y-4">
        <Link href="/mas" className="text-sm text-neutral-400">
          ← Más
        </Link>
        <h1 className="font-display text-4xl font-bold">Eliminar mi cuenta</h1>

        <Suspense fallback={<p className="text-neutral-400">Cargando…</p>}>
          <DeleteForm searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  )
}
