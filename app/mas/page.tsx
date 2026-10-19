import { Suspense } from 'react'
import Link from 'next/link'
import { connection } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import InstallCard from '@/components/InstallCard'
import { logout } from '../login/actions'

// Todo lo que lee sesion o datos va dentro de Suspense, y empieza con connection()
async function MoreContent() {
  await connection()

  const supabase = await createClient()

  const [{ data: claimsData }, painRes] = await Promise.all([
    supabase.auth.getClaims(),
    supabase
      .from('pain_reports')
      .select('id', { count: 'exact', head: true })
      .is('resolved_on', null),
  ])

  const email = claimsData?.claims?.email
  const painCount = painRes.count ?? 0

  const items = [
    {
      href: '/checkin',
      title: 'Check-in de la mañana',
      desc: 'Sueño, energía y dolor muscular',
      badge: null as string | null,
    },
    {
      href: '/competencias',
      title: 'Competencias',
      desc: 'Fechas, objetivos y resultados',
      badge: null,
    },
    {
      href: '/molestias',
      title: 'Molestias',
      desc: 'Activas, historial y zonas que se repiten',
      badge: painCount > 0 ? String(painCount) : null,
    },
    {
      href: '/perfil',
      title: 'Mi ficha',
      desc: 'Datos personales, peso y objetivos',
      badge: null,
    },
  ]

  return (
    <div className="space-y-6">
      <InstallCard />

      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="flex items-center justify-between gap-3 rounded-2xl bg-neutral-900 p-4"
            >
              <div className="min-w-0">
                <p className="font-semibold">{item.title}</p>
                <p className="text-sm text-neutral-400">{item.desc}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {item.badge && (
                  <span
                    className="rounded-full bg-amber-900 px-2.5 py-0.5 text-xs font-semibold text-amber-200"
                    aria-label={`${item.badge} activas`}
                  >
                    {item.badge}
                  </span>
                )}
                <span aria-hidden className="text-xl text-neutral-500">
                  ›
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <section className="space-y-1 rounded-2xl bg-neutral-900 p-4">
        <h2 className="mb-1 font-display text-2xl font-semibold leading-none">Tus datos</h2>

        {/* Enlace comun (no Link): es una descarga, no una navegacion de la app */}
        <a
          href="/mas/exportar"
          download
          className="flex items-center justify-between rounded-xl py-3 text-sm"
        >
          <span className="font-medium">Descargar mis datos</span>
          <span className="text-neutral-400">.json</span>
        </a>

        <div className="border-t border-neutral-700" />

        <Link
          href="/privacidad"
          className="flex items-center justify-between rounded-xl py-3 text-sm"
        >
          <span className="font-medium">Política de privacidad</span>
          <span aria-hidden className="text-neutral-500">›</span>
        </Link>

        <div className="border-t border-neutral-700" />

        <Link
          href="/terminos"
          className="flex items-center justify-between rounded-xl py-3 text-sm"
        >
          <span className="font-medium">Términos de uso</span>
          <span aria-hidden className="text-neutral-500">›</span>
        </Link>

        <div className="border-t border-neutral-700" />

        <Link
          href="/mas/eliminar"
          className="flex items-center justify-between rounded-xl py-3 text-sm text-red-300"
        >
          <span className="font-medium">Eliminar mi cuenta</span>
          <span aria-hidden>›</span>
        </Link>
      </section>

      <section className="space-y-3 rounded-2xl bg-neutral-900 p-4">
        <div>
          <p className="text-sm text-neutral-400">Sesión iniciada como</p>
          <p className="truncate font-medium">{email}</p>
        </div>
        <form action={logout}>
          <button className="w-full rounded-xl border border-neutral-600 p-3 font-medium">
            Cerrar sesión
          </button>
        </form>
      </section>

      <p className="text-xs text-neutral-500">
        Esta app es una herramienta de apoyo y no reemplaza a un médico ni a un entrenador.
      </p>
    </div>
  )
}

export default function MasPage() {
  return (
    <main className="app-main">
      <div className="mx-auto max-w-md space-y-4">
        <h1 className="font-display text-4xl font-bold">Más</h1>
        <Suspense fallback={<p className="text-neutral-400">Cargando…</p>}>
          <MoreContent />
        </Suspense>
      </div>
    </main>
  )
}
