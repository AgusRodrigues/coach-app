import { Suspense } from 'react'
import Link from 'next/link'
import { connection } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { addDays, daysBetween, shortDate, todayISO } from '@/lib/dates'
import { createPain, deletePain, resolvePain, updatePain } from './actions'

type Search = Promise<{ error?: string; message?: string }>

type PainRow = {
  id: string
  zone_code: string
  pain_type: string
  intensity: number
  reported_on: string
  resolved_on: string | null
  notes: string | null
}

const PAIN_TYPES = [
  { value: 'tiron', label: 'Tirón' },
  { value: 'agudo', label: 'Dolor agudo' },
  { value: 'carga_muscular', label: 'Carga muscular' },
  { value: 'articular', label: 'Articular' },
  { value: 'otro', label: 'Otro' },
]
const typeLabel: Record<string, string> = Object.fromEntries(
  PAIN_TYPES.map((t) => [t.value, t.label])
)

const inputClass =
  'w-full rounded-lg border border-neutral-700 bg-neutral-800 p-3 text-neutral-100'

// Criterio de aviso: dolor agudo, intensidad alta o que dura una semana o mas
function needsAttention(p: PainRow, days: number): boolean {
  return p.pain_type === 'agudo' || p.intensity >= 6 || days >= 7
}

// Zonas con 2 o mas episodios en los ultimos 90 dias.
// Reportes de la misma zona separados por 7 dias o menos cuentan como un solo episodio.
function recurrentZones(rows: PainRow[], today: string) {
  const cutoff = addDays(today, -90)
  const byZone = new Map<string, PainRow[]>()

  for (const r of rows) {
    if (r.reported_on < cutoff) continue
    byZone.set(r.zone_code, [...(byZone.get(r.zone_code) ?? []), r])
  }

  const out: { zone: string; episodes: number; last: string }[] = []

  for (const [zone, list] of byZone) {
    const sorted = [...list].sort((a, b) => a.reported_on.localeCompare(b.reported_on))
    let episodes = 0
    let lastEnd: string | null = null

    for (const r of sorted) {
      if (lastEnd === null || daysBetween(lastEnd, r.reported_on) > 7) episodes++
      // Una molestia sin resolver sigue en curso: llega hasta hoy
      const end = r.resolved_on ?? today
      if (lastEnd === null || end > lastEnd) lastEnd = end
    }

    if (episodes >= 2) {
      out.push({ zone, episodes, last: sorted[sorted.length - 1].reported_on })
    }
  }

  return out.sort((a, b) => b.episodes - a.episodes)
}

// Todo lo que lee sesion o datos va dentro de Suspense, y empieza con connection()
async function MolestiasContent({ searchParams }: { searchParams: Search }) {
  await connection()

  const { error, message } = await searchParams
  const today = todayISO()
  const supabase = await createClient()

  const { data: zonesData } = await supabase
    .from('body_zones')
    .select('code, label')
    .order('label')
  const zones = (zonesData ?? []) as { code: string; label: string }[]
  const zoneLabel = new Map(zones.map((z) => [z.code, z.label]))

  const { data: rowsData, error: dbError } = await supabase
    .from('pain_reports')
    .select('id, zone_code, pain_type, intensity, reported_on, resolved_on, notes')
    .order('reported_on', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(500)

  const rows = (rowsData ?? []) as PainRow[]
  const active = rows.filter((r) => r.resolved_on === null)
  const resolved = rows.filter((r) => r.resolved_on !== null).slice(0, 15)
  const recurring = recurrentZones(rows, today)

  const labelOf = (code: string) => zoneLabel.get(code) ?? code

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
          Error al cargar las molestias: {dbError.message}
        </p>
      )}

      <p className="text-xs text-neutral-500">
        Esta sección sirve para llevar el registro, no para diagnosticar. Ante un dolor
        agudo, que empeora o que dura más de unos días, consultá a un profesional.
      </p>

      {/* Activas */}
      <section className="space-y-3">
        <h2 className="font-medium">Activas ({active.length})</h2>

        {active.length === 0 ? (
          <p className="rounded-xl bg-neutral-900 p-4 text-sm text-neutral-500">
            No tenés molestias activas. 👏
          </p>
        ) : (
          active.map((p) => {
            const days = Math.max(0, daysBetween(p.reported_on, today))
            const attention = needsAttention(p, days)

            return (
              <article
                key={p.id}
                className={`space-y-3 rounded-xl p-4 ${
                  attention ? 'bg-amber-950/60 ring-1 ring-amber-700' : 'bg-neutral-900'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{labelOf(p.zone_code)}</p>
                    <p className="text-sm text-neutral-400">
                      {typeLabel[p.pain_type] ?? p.pain_type} · intensidad {p.intensity}/10
                    </p>
                    <p className="text-xs text-neutral-500">
                      Desde el {shortDate(p.reported_on)} ·{' '}
                      {days === 0 ? 'hoy' : `${days} ${days === 1 ? 'día' : 'días'}`}
                    </p>
                  </div>
                </div>

                {p.notes && <p className="text-sm text-neutral-400">{p.notes}</p>}

                {attention && (
                  <p className="text-sm text-amber-300">
                    Conviene que la evalúe un profesional (médico del deporte o
                    kinesiólogo) antes de seguir con velocidad o cargas altas.
                  </p>
                )}

                <form action={resolvePain}>
                  <input type="hidden" name="id" value={p.id} />
                  <button className="w-full rounded-lg bg-brand p-3 font-medium text-on-brand">
                    Marcar resuelta
                  </button>
                </form>

                <details className="text-sm">
                  <summary className="cursor-pointer text-neutral-400">Editar</summary>
                  <div className="mt-3 space-y-3">
                    <form action={updatePain} className="flex items-end gap-2">
                      <input type="hidden" name="id" value={p.id} />
                      <label className="min-w-0 flex-1 space-y-1 text-xs text-neutral-400">
                        <span>Intensidad actual (0 a 10)</span>
                        <input
                          type="number"
                          inputMode="numeric"
                          name="intensity"
                          min="0"
                          max="10"
                          defaultValue={p.intensity}
                          className={inputClass}
                        />
                      </label>
                      <button className="rounded-lg border border-neutral-600 px-4 py-3">
                        Guardar
                      </button>
                    </form>

                    <form action={deletePain}>
                      <input type="hidden" name="id" value={p.id} />
                      <button className="text-red-400">Eliminar (fue un error)</button>
                    </form>
                  </div>
                </details>
              </article>
            )
          })
        )}
      </section>

      {/* Recurrentes */}
      {recurring.length > 0 && (
        <section className="space-y-2 rounded-xl bg-neutral-900 p-4">
          <h2 className="font-medium">Zonas que se repiten</h2>
          <ul className="space-y-1 text-sm">
            {recurring.map((r) => (
              <li key={r.zone} className="text-neutral-300">
                <span className="font-medium">{labelOf(r.zone)}</span>:{' '}
                {r.episodes} episodios en los últimos 90 días{' '}
                <span className="text-neutral-500">(último: {shortDate(r.last)})</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-neutral-500">
            Una molestia que vuelve en la misma zona merece una consulta con un
            profesional, aunque cada vez se haya ido sola.
          </p>
        </section>
      )}

      {/* Nueva molestia */}
      <details className="rounded-xl bg-neutral-900 p-4">
        <summary className="cursor-pointer font-medium">+ Registrar molestia</summary>

        <form action={createPain} className="mt-4 space-y-3">
          <select name="zone" required defaultValue="" className={inputClass}>
            <option value="" disabled>
              Zona del cuerpo…
            </option>
            {zones.map((z) => (
              <option key={z.code} value={z.code}>
                {z.label}
              </option>
            ))}
          </select>

          <select name="type" defaultValue="carga_muscular" className={inputClass}>
            {PAIN_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1 text-xs text-neutral-400">
              <span>Intensidad (0 a 10)</span>
              <input
                type="number"
                inputMode="numeric"
                name="intensity"
                min="0"
                max="10"
                required
                defaultValue="3"
                className={inputClass}
              />
            </label>
            <label className="space-y-1 text-xs text-neutral-400">
              <span>Desde</span>
              <input
                type="date"
                name="date"
                required
                max={today}
                defaultValue={today}
                className={inputClass}
              />
            </label>
          </div>

          <textarea
            name="notes"
            rows={2}
            placeholder="Notas (opcional)"
            className={inputClass}
          />

          <button className="w-full rounded-lg bg-brand p-3 font-medium text-on-brand">
            Guardar molestia
          </button>
        </form>
      </details>

      {/* Historial */}
      {resolved.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-medium">Historial</h2>
          <ul className="space-y-2">
            {resolved.map((p) => {
              const days = Math.max(0, daysBetween(p.reported_on, p.resolved_on as string))
              return (
                <li key={p.id} className="rounded-xl bg-neutral-900 p-3 text-sm">
                  <p className="font-medium">{labelOf(p.zone_code)}</p>
                  <p className="text-neutral-400">
                    {typeLabel[p.pain_type] ?? p.pain_type} · intensidad {p.intensity}/10
                  </p>
                  <p className="text-xs text-neutral-500">
                    {shortDate(p.reported_on)} → {shortDate(p.resolved_on as string)} ·{' '}
                    {days === 0 ? 'el mismo día' : `${days} ${days === 1 ? 'día' : 'días'}`}
                  </p>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}

export default function MolestiasPage({ searchParams }: { searchParams: Search }) {
  return (
    <main className="app-main">
      <div className="mx-auto max-w-md space-y-4">
        <Link href="/" className="text-sm text-neutral-400">
          ← Inicio
        </Link>
        <h1 className="font-display text-4xl font-bold">Molestias</h1>

        <Suspense fallback={<p className="text-neutral-400">Cargando…</p>}>
          <MolestiasContent searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  )
}
