import type { SupabaseClient } from '@supabase/supabase-js'

export type HistSet = { reps: number; load: number }
export type HistExercise = { exerciseId: string; name: string; sets: HistSet[] }
export type DayHistory = { label: string; exercises: HistExercise[] }
export type CatalogItem = { id: string; name: string; category: string }

export type GymHistory = {
  days: DayHistory[] // ordenados del mas reciente al menos reciente
  catalog: CatalogItem[]
  lastByExercise: Record<string, HistSet[]> // ultima vez que hiciste cada ejercicio
  suggestedDay: string // el dia que hace mas tiempo que no hacias
}

type SetRow = {
  session_id: string
  exercise_id: string
  exercise_order: number
  set_number: number
  reps: number
  load_kg: number | string
  exercises: { name: string } | { name: string }[] | null
}

const MAX_DAYS = 8
const SESSIONS_WINDOW = 30

export async function loadGymHistory(supabase: SupabaseClient): Promise<GymHistory> {
  // Catalogo: ejercicios globales + los propios (RLS filtra)
  const { data: catalogData } = await supabase
    .from('exercises')
    .select('id, name, category')
    .order('name')
  const catalog = (catalogData ?? []) as CatalogItem[]

  // Ultimas sesiones de gimnasio, de la mas reciente a la mas vieja
  const { data: sessionData } = await supabase
    .from('session_logs')
    .select('id, gym_day')
    .eq('kind', 'gym')
    .order('started_at', { ascending: false })
    .limit(SESSIONS_WINDOW)
  const sessions = (sessionData ?? []) as { id: string; gym_day: string | null }[]

  if (sessions.length === 0) {
    return { days: [], catalog, lastByExercise: {}, suggestedDay: '' }
  }

  const { data: setData } = await supabase
    .from('gym_sets')
    .select('session_id, exercise_id, exercise_order, set_number, reps, load_kg, exercises(name)')
    .in(
      'session_id',
      sessions.map((s) => s.id)
    )
  const rows = (setData ?? []) as SetRow[]

  // Agrupar: sesion -> ejercicio -> series
  type Grouped = { name: string; order: number; sets: { n: number; reps: number; load: number }[] }
  const bySession = new Map<string, Map<string, Grouped>>()

  for (const r of rows) {
    const exName = Array.isArray(r.exercises) ? r.exercises[0]?.name : r.exercises?.name
    const exMap = bySession.get(r.session_id) ?? new Map<string, Grouped>()
    const g = exMap.get(r.exercise_id) ?? {
      name: exName ?? 'Ejercicio',
      order: r.exercise_order,
      sets: [],
    }
    g.sets.push({ n: r.set_number, reps: r.reps, load: Number(r.load_kg) })
    exMap.set(r.exercise_id, g)
    bySession.set(r.session_id, exMap)
  }

  function exercisesOf(sessionId: string): HistExercise[] {
    const exMap = bySession.get(sessionId)
    if (!exMap) return []
    return [...exMap.entries()]
      .sort((a, b) => a[1].order - b[1].order)
      .map(([exerciseId, g]) => ({
        exerciseId,
        name: g.name,
        sets: [...g.sets]
          .sort((a, b) => a.n - b.n)
          .map((s) => ({ reps: s.reps, load: s.load })),
      }))
  }

  const days: DayHistory[] = []
  const seenDays = new Set<string>()
  const lastByExercise: Record<string, HistSet[]> = {}

  // Las sesiones ya vienen de la mas reciente a la mas vieja
  for (const s of sessions) {
    const exercises = exercisesOf(s.id)
    if (exercises.length === 0) continue

    if (s.gym_day && !seenDays.has(s.gym_day) && days.length < MAX_DAYS) {
      seenDays.add(s.gym_day)
      days.push({ label: s.gym_day, exercises })
    }

    for (const ex of exercises) {
      if (!(ex.exerciseId in lastByExercise)) lastByExercise[ex.exerciseId] = ex.sets
    }
  }

  // Sugerencia: el dia que hace mas tiempo que no hiciste (el ultimo de la lista)
  const suggestedDay = days.length > 0 ? days[days.length - 1].label : ''

  return { days, catalog, lastByExercise, suggestedDay }
}