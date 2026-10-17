import type { SupabaseClient } from '@supabase/supabase-js'
import { addDays, isoDateInTZ, mondayOf, todayISO } from '@/lib/dates'

export type TrackPoint = { date: string; cs: number; wind: number | null }
export type StrengthPoint = { date: string; load: number; reps: number }

export type ProgressData = {
  // Mejor tiempo de cada dia, por distancia (la mas entrenada primero)
  track: { distance: number; points: TrackPoint[] }[]
  // Carga de la semana = suma de (RPE x minutos)
  weeklyLoad: { week: string; load: number; sessions: number }[]
  // Mayor carga de cada dia, por ejercicio (el mas entrenado primero)
  strength: { id: string; name: string; points: StrengthPoint[] }[]
  checkins: {
    date: string
    sleep: number | null
    energy: number | null
    soreness: number | null
  }[]
  weight: { date: string; kg: number }[]
}

const PAGE_SIZE = 1000
const MAX_PAGES = 30

// PostgREST devuelve como maximo 1000 filas por consulta: se pide de a paginas.
async function fetchAll<T>(
  build: (
    from: number,
    to: number
  ) => PromiseLike<{ data: unknown[] | null; error: unknown }>
): Promise<T[]> {
  const out: T[] = []
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE
    const { data, error } = await build(from, from + PAGE_SIZE - 1)
    if (error || !data) break
    out.push(...(data as T[]))
    if (data.length < PAGE_SIZE) break
  }
  return out
}

// Un embed de PostgREST puede venir como objeto o como lista de un elemento
function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

type EffortRow = {
  distance_m: number
  time_cs: number
  wind_ms: number | string | null
  session_logs: { started_at: string } | { started_at: string }[] | null
}

type SessionRow = {
  started_at: string
  session_load: number | null
}

type SetRow = {
  exercise_id: string
  reps: number
  load_kg: number | string
  exercises: { name: string } | { name: string }[] | null
  session_logs: { started_at: string } | { started_at: string }[] | null
}

type CheckinRow = {
  checkin_date: string
  sleep_hours: number | string | null
  energy: number | null
  soreness: number | null
}

type WeightRow = { measured_on: string; weight_kg: number | string | null }

export async function loadProgress(supabase: SupabaseClient): Promise<ProgressData> {
  const [efforts, sessions, sets, checkins, weights] = await Promise.all([
    fetchAll<EffortRow>((from, to) =>
      supabase
        .from('track_efforts')
        .select('id, distance_m, time_cs, wind_ms, session_logs(started_at)')
        .order('id')
        .range(from, to)
    ),
    fetchAll<SessionRow>((from, to) =>
      supabase
        .from('session_logs')
        .select('id, started_at, session_load')
        .order('id')
        .range(from, to)
    ),
    fetchAll<SetRow>((from, to) =>
      supabase
        .from('gym_sets')
        .select(
          'id, exercise_id, reps, load_kg, exercises(name), session_logs(started_at)'
        )
        .order('id')
        .range(from, to)
    ),
    fetchAll<CheckinRow>((from, to) =>
      supabase
        .from('daily_checkins')
        .select('id, checkin_date, sleep_hours, energy, soreness')
        .order('id')
        .range(from, to)
    ),
    fetchAll<WeightRow>((from, to) =>
      supabase
        .from('body_measurements')
        .select('id, measured_on, weight_kg')
        .order('id')
        .range(from, to)
    ),
  ])

  // ---- Pista: mejor tiempo por dia y distancia ----
  const trackMap = new Map<number, Map<string, TrackPoint>>()
  const trackCount = new Map<number, number>()

  for (const e of efforts) {
    const session = one(e.session_logs)
    if (!session) continue

    const date = isoDateInTZ(session.started_at)
    const wind = e.wind_ms === null ? null : Number(e.wind_ms)

    const byDate = trackMap.get(e.distance_m) ?? new Map<string, TrackPoint>()
    const current = byDate.get(date)
    if (!current || e.time_cs < current.cs) {
      byDate.set(date, { date, cs: e.time_cs, wind })
    }
    trackMap.set(e.distance_m, byDate)
    trackCount.set(e.distance_m, (trackCount.get(e.distance_m) ?? 0) + 1)
  }

  const track = [...trackMap.entries()]
    .sort((a, b) => (trackCount.get(b[0]) ?? 0) - (trackCount.get(a[0]) ?? 0))
    .map(([distance, byDate]) => ({
      distance,
      points: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
    }))

  // ---- Carga semanal (RPE x minutos), con semanas vacias en cero ----
  const weekMap = new Map<string, { load: number; sessions: number }>()
  for (const s of sessions) {
    if (s.session_load === null) continue
    const week = mondayOf(isoDateInTZ(s.started_at))
    const w = weekMap.get(week) ?? { load: 0, sessions: 0 }
    w.load += s.session_load
    w.sessions += 1
    weekMap.set(week, w)
  }

  const weeklyLoad: ProgressData['weeklyLoad'] = []
  const weeks = [...weekMap.keys()].sort()
  if (weeks.length > 0) {
    const lastWeek = mondayOf(todayISO())
    let w = weeks[0]
    for (let i = 0; i < 520 && w <= lastWeek; i++) {
      const data = weekMap.get(w)
      weeklyLoad.push({ week: w, load: data?.load ?? 0, sessions: data?.sessions ?? 0 })
      w = addDays(w, 7)
    }
  }

  // ---- Fuerza: mayor carga por dia y ejercicio ----
  const strengthMap = new Map<
    string,
    { name: string; byDate: Map<string, StrengthPoint>; count: number }
  >()

  for (const s of sets) {
    const session = one(s.session_logs)
    if (!session) continue

    const load = Number(s.load_kg)
    if (!(load > 0)) continue // peso corporal: no se grafica

    const date = isoDateInTZ(session.started_at)
    const entry = strengthMap.get(s.exercise_id) ?? {
      name: one(s.exercises)?.name ?? 'Ejercicio',
      byDate: new Map<string, StrengthPoint>(),
      count: 0,
    }

    const current = entry.byDate.get(date)
    if (!current || load > current.load || (load === current.load && s.reps > current.reps)) {
      entry.byDate.set(date, { date, load, reps: s.reps })
    }
    entry.count += 1
    strengthMap.set(s.exercise_id, entry)
  }

  const strength = [...strengthMap.entries()]
    .sort((a, b) => b[1].byDate.size - a[1].byDate.size || b[1].count - a[1].count)
    .map(([id, e]) => ({
      id,
      name: e.name,
      points: [...e.byDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
    }))

  // ---- Check-ins ----
  const checkinList = checkins
    .map((c) => ({
      date: c.checkin_date,
      sleep: c.sleep_hours === null ? null : Number(c.sleep_hours),
      energy: c.energy,
      soreness: c.soreness,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // ---- Peso (si hay varias mediciones el mismo dia, queda la ultima) ----
  const weightMap = new Map<string, number>()
  for (const w of weights) {
    if (w.weight_kg === null) continue
    weightMap.set(w.measured_on, Number(w.weight_kg))
  }
  const weight = [...weightMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, kg]) => ({ date, kg }))

  return { track, weeklyLoad, strength, checkins: checkinList, weight }
}