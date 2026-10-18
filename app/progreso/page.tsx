import { Suspense } from 'react'
import Link from 'next/link'
import { connection } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { loadProgress } from '@/lib/progress'
import { todayISO } from '@/lib/dates'
import ProgressCharts from './ProgressCharts'

// Todo lo que lee sesion o datos va dentro de Suspense, y empieza con connection()
async function ProgressContent() {
  await connection()

  const supabase = await createClient()
  const data = await loadProgress(supabase)

  return <ProgressCharts data={data} today={todayISO()} />
}

export default function ProgresoPage() {
  return (
    <main className="app-main">
      <div className="mx-auto max-w-md space-y-4">
        <Link href="/" className="text-sm text-neutral-400">
          ← Inicio
        </Link>
        <h1 className="font-display text-4xl font-bold">Progreso</h1>

        <Suspense fallback={<p className="text-neutral-400">Cargando gráficos…</p>}>
          <ProgressContent />
        </Suspense>
      </div>
    </main>
  )
}
