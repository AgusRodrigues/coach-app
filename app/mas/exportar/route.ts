import { connection } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/server'
import { todayISO } from '@/lib/dates'

// Tablas de datos personales. RLS garantiza que cada consulta devuelve solo lo del usuario.
const TABLES = [
  'profiles',
  'body_measurements',
  'calendar_events',
  'session_logs',
  'track_efforts',
  'gym_sets',
  'pain_reports',
  'daily_checkins',
  'competitions',
]

const PAGE_SIZE = 1000
const MAX_PAGES = 50

// PostgREST devuelve como maximo 1000 filas por consulta: se pide de a paginas
async function fetchAll(supabase: SupabaseClient, table: string, ownOnly = false) {
  const rows: unknown[] = []

  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE
    let query = supabase.from(table).select('*').order('id')
    if (ownOnly) query = query.not('user_id', 'is', null)

    const { data, error } = await query.range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(`No se pudo leer ${table}: ${error.message}`)
    if (!data) break

    rows.push(...data)
    if (data.length < PAGE_SIZE) break
  }

  return rows
}

export async function GET() {
  await connection()

  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const claims = claimsData?.claims

  if (!claims) return new Response('No autorizado', { status: 401 })

  try {
    const exported: Record<string, unknown> = {
      exportado_el: new Date().toISOString(),
      cuenta: { id: claims.sub, email: claims.email },
    }

    for (const table of TABLES) {
      exported[table] = await fetchAll(supabase, table)
    }

    // Ejercicios propios (los del catalogo general no son datos tuyos)
    exported.ejercicios_propios = await fetchAll(supabase, 'exercises', true)

    return new Response(JSON.stringify(exported, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="coach-datos-${todayISO()}.json"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch {
    return new Response('No se pudieron exportar los datos. Probá de nuevo en unos minutos.', {
      status: 500,
    })
  }
}
