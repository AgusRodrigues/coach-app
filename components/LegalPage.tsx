import Link from 'next/link'
import { LEGAL_UPDATED } from '@/lib/legal'

export function LegalSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-2">
      <h2 className="font-display text-2xl font-semibold text-neutral-100">{title}</h2>
      {children}
    </section>
  )
}

export default function LegalPage({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <main className="app-main">
      <article className="mx-auto max-w-md space-y-6 text-[15px] leading-relaxed text-neutral-300">
        <Link href="/" className="text-sm text-neutral-400">
          ← Volver
        </Link>

        <header className="space-y-1">
          <h1 className="font-display text-4xl font-bold text-neutral-100">{title}</h1>
          <p className="text-sm text-neutral-500">Última actualización: {LEGAL_UPDATED}</p>
        </header>

        {children}
      </article>
    </main>
  )
}
