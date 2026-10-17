'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { isoDateInTZ, mondayOf } from '@/lib/dates'
import { parseTimeToCs } from '@/lib/time'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PAIN_TYPES = ['tiron', 'agudo', 'carga_muscular', 'articular', 'otro']
const START_TYPES = ['tacos', 'parado', 'lanzado']
const MAX_EFFORTS = 40
const MAX_GYM_EXERCISES = 30
const MAX_GYM_SETS = 20

// Entero dentro de un rango; si no es valido, devuelve null
function intIn(value: FormDataEntryValue | null, min: number, max: number): number | null {
  const s = String(value ?? '').trim()
  if (!/^\d+$/.test(s)) return null
  const n = parseInt(s, 10)
  return n >= min && n <= max ? n : null
}

// Numero decimal ("1,5" o "1.5"); vacio -> null; invalido -> NaN
function decimalOrNull(value: FormDataEntryValue | null): number | null {
  const s = String(value ?? '').trim().replace(',', '.')
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : NaN
}

type Effort = {
  rep_number: number
  distance_m: number
  time_cs: number
  rest_s: number | null
  wind_ms: number | null
}

type GymExerciseInput = {
  exerciseId: string | null
  newName: string | null
  sets: { reps: number; load_kg: number }[]
}

type GymParsed = { day: string | null; exercises: GymExerciseInput[] } | { error: string }

// Valida el JSON que manda el editor de gimnasio. No se confia en nada.
function parseGymPayload(raw: string): GymParsed {
  if (!raw.trim()) return { day: null, exercises: [] }

  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return { error: 'Los datos del gimnasio no son válidos.' }
  }
  if (typeof data !== 'object' || data === null) {
    return { error: 'Los datos del gimnasio no son válidos.' }
  }

  const obj = data as Record<string, unknown>
  const day = typeof obj.day === 'string' ? obj.day.trim().slice(0, 40) : ''

  if (!Array.isArray(obj.exercises) || obj.exercises.length > MAX_GYM_EXERCISES) {
    return { error: `Se pueden cargar hasta ${MAX_GYM_EXERCISES} ejercicios por sesión.` }
  }

  const exercises: GymExerciseInput[] = []

  for (let i = 0; i < obj.exercises.length; i++) {
    const ex = obj.exercises[i] as Record<string, unknown> | null
    if (typeof ex !== 'object' || ex === null) {
      return { error: `Ejercicio ${i + 1}: datos inválidos.` }
    }

    const exerciseId =
      typeof ex.exercise_id === 'string' && UUID.test(ex.exercise_id) ? ex.exercise_id : null
    const newName = typeof ex.new_name === 'string' ? ex.new_name.trim().slice(0, 60) : ''

    if (!exerciseId && !newName) {
      return { error: `Ejercicio ${i + 1}: falta el nombre.` }
    }

    if (!Array.isArray(ex.sets) || ex.sets.length < 1 || ex.sets.length > MAX_GYM_SETS) {
      return { error: `Ejercicio ${i + 1}: cargá entre 1 y ${MAX_GYM_SETS} series.` }
    }

    const sets: { reps: number; load_kg: number }[] = []
    for (let j = 0; j < ex.sets.length; j++) {
      const s = ex.sets[j] as Record<string, unknown> | null
      const repsStr = typeof s?.reps === 'string' ? s.reps.trim() : ''
      const loadStr =
        typeof s?.load === 'string' ? s.load.trim().replace(',', '.') : ''

      if (!/^\d{1,3}$/.test(repsStr) || +repsStr < 1 || +repsStr > 200) {
        return { error: `Ejercicio ${i + 1}, serie ${j + 1}: las repeticiones deben ser de 1 a 200.` }
      }

      // Kilos vacios = peso corporal = 0
      const load = loadStr === '' ? 0 : Number(loadStr)
      if (!Number.isFinite(load) || load < 0 || load > 1000) {
        return { error: `Ejercicio ${i + 1}, serie ${j + 1}: los kilos deben ser de 0 a 1000.` }
      }

      sets.push({ reps: parseInt(repsStr, 10), load_kg: Math.round(load * 100) / 100 })
    }

    exercises.push({ exerciseId, newName: exerciseId ? null : newName, sets })
  }

  return { day: day || null, exercises }
}

export async function saveSession(formData: FormData) {
  const supabase = await createClient()

  const eventId = String(formData.get('event_id') ?? '')
  if (!UUID.test(eventId)) redirect('/calendario')

  function failHere(text: string): never {
    redirect(`/sesion/${eventId}?error=${encodeURIComponent(text)}`)
  }

  const rpe = intIn(formData.get('rpe'), 1, 10)
  const feeling = intIn(formData.get('feeling'), 1, 5)
  const duration = intIn(formData.get('duration_min'), 1, 600)
  const notes = String(formData.get('notes') ?? '').trim() || null

  if (rpe === null) failHere('Elegí el esfuerzo de la sesión (1 a 10).')
  if (feeling === null) failHere('Elegí cómo te sentiste.')
  if (duration === null) failHere('La duración tiene que ser de 1 a 600 minutos.')

  // RLS: solo encuentra eventos propios
  const { data: event } = await supabase
    .from('calendar_events')
    .select('id, kind, starts_at')
    .eq('id', eventId)
    .maybeSingle()

  if (!event) redirect('/calendario?error=' + encodeURIComponent('No se encontró el evento.'))

  const eventDate = isoDateInTZ(event.starts_at)
  const week = mondayOf(eventDate)

  // --- Repeticiones de pista: se validan ANTES de guardar nada ---
  const efforts: Effort[] = []
  let startType: string | null = null
  let surface: string | null = null

  if (event.kind === 'track') {
    const distances = formData.getAll('e_distance').map(String)
    const times = formData.getAll('e_time').map(String)
    const rests = formData.getAll('e_rest')
    const winds = formData.getAll('e_wind')

    const rawStart = String(formData.get('start_type') ?? '')
    startType = START_TYPES.includes(rawStart) ? rawStart : null
    surface = String(formData.get('surface') ?? '').trim() || null

    for (let i = 0; i < times.length && i < MAX_EFFORTS; i++) {
      // Una fila sin tiempo se ignora
      if (!times[i].trim()) continue

      const distance = intIn(distances[i] ?? '', 10, 1000)
      const timeCs = parseTimeToCs(times[i])
      const restMin = decimalOrNull(rests[i] ?? null)
      const wind = decimalOrNull(winds[i] ?? null)

      if (distance === null) {
        failHere(`Fila ${i + 1}: la distancia tiene que estar entre 10 y 1000 m.`)
      }
      if (timeCs === null) {
        failHere(`Fila ${i + 1}: el tiempo no es válido (ej: 10.85 o 1:02.30).`)
      }
      if (restMin !== null && (Number.isNaN(restMin) || restMin < 0 || restMin > 120)) {
        failHere(`Fila ${i + 1}: el descanso no es válido.`)
      }
      if (wind !== null && (Number.isNaN(wind) || wind < -10 || wind > 10)) {
        failHere(`Fila ${i + 1}: el viento tiene que estar entre -10 y 10 m/s.`)
      }

      efforts.push({
        rep_number: efforts.length + 1,
        distance_m: distance,
        time_cs: timeCs,
        rest_s: restMin === null ? null : Math.round(restMin * 60),
        wind_ms: wind === null ? null : Math.round(wind * 10) / 10,
      })
    }
  }

  // --- Gimnasio: tambien se valida ANTES de guardar nada ---
  let gymDay: string | null = null
  let gymExercises: GymExerciseInput[] = []

  if (event.kind === 'gym') {
    const parsed = parseGymPayload(String(formData.get('gym_payload') ?? ''))
    if ('error' in parsed) return failHere(parsed.error)
    gymDay = parsed.day
    gymExercises = parsed.exercises
  }

  // Evitar registrar dos veces la misma sesion
  const { data: existing } = await supabase
    .from('session_logs')
    .select('id')
    .eq('event_id', eventId)
    .limit(1)

  if (existing && existing.length > 0) {
    redirect(
      `/calendario?semana=${week}&error=` +
        encodeURIComponent('Esa sesión ya estaba registrada.')
    )
  }

  // Ejercicios nuevos escritos a mano: se reutiliza el existente si ya hay uno
  // con el mismo nombre, y si no, se crea como ejercicio propio.
  const resolvedExerciseIds: string[] = []

  if (gymExercises.length > 0) {
    const nameToId = new Map<string, string>()
    let userId: string | undefined

    if (gymExercises.some((e) => !e.exerciseId)) {
      const { data: visible } = await supabase.from('exercises').select('id, name')
      for (const ex of visible ?? []) {
        nameToId.set(String(ex.name).toLowerCase(), String(ex.id))
      }
      const { data: claimsData } = await supabase.auth.getClaims()
      userId = claimsData?.claims?.sub
      if (!userId) redirect('/login')
    }

    for (const ex of gymExercises) {
      if (ex.exerciseId) {
        resolvedExerciseIds.push(ex.exerciseId)
        continue
      }

      const name = ex.newName as string
      const key = name.toLowerCase()
      let id = nameToId.get(key)

      if (!id) {
        const { data: created, error: createError } = await supabase
          .from('exercises')
          .insert({ user_id: userId, name, category: 'otro' })
          .select('id')
          .single()

        if (createError || !created) failHere(`No se pudo crear el ejercicio «${name}».`)
        id = String(created!.id)
        nameToId.set(key, id)
      }

      resolvedExerciseIds.push(id)
    }
  }

  const sessionKind =
    event.kind === 'track' ? 'track' : event.kind === 'gym' ? 'gym' : 'other'

  const { data: session, error } = await supabase
    .from('session_logs')
    .insert({
      event_id: eventId,
      kind: sessionKind,
      started_at: event.starts_at,
      duration_min: duration,
      rpe,
      feeling,
      notes,
      gym_day: gymDay,
    })
    .select('id')
    .single()

  if (error || !session) failHere('No se pudo guardar la sesión.')

  // Guardar repeticiones de pista
  if (efforts.length > 0) {
    const { error: effortsError } = await supabase.from('track_efforts').insert(
      efforts.map((e) => ({
        ...e,
        session_id: session!.id,
        start_type: startType,
        surface,
      }))
    )

    if (effortsError) {
      redirect(
        `/calendario?semana=${week}&error=` +
          encodeURIComponent(
            'La sesión se guardó, pero no se pudieron guardar las repeticiones.'
          )
      )
    }
  }

  // Guardar series de gimnasio
  if (gymExercises.length > 0) {
    const setRows = gymExercises.flatMap((ex, exIndex) =>
      ex.sets.map((s, setIndex) => ({
        session_id: session!.id,
        exercise_id: resolvedExerciseIds[exIndex],
        exercise_order: exIndex + 1,
        set_number: setIndex + 1,
        reps: s.reps,
        load_kg: s.load_kg,
      }))
    )

    const { error: setsError } = await supabase.from('gym_sets').insert(setRows)

    if (setsError) {
      redirect(
        `/calendario?semana=${week}&error=` +
          encodeURIComponent('La sesión se guardó, pero no se pudieron guardar las series.')
      )
    }
  }

  // Molestia (opcional): solo si se eligio una zona
  const zone = String(formData.get('pain_zone') ?? '')
  let painWarning = false

  if (zone) {
    const painType = String(formData.get('pain_type') ?? '')
    const intensity = intIn(formData.get('pain_intensity'), 0, 10)

    if (!PAIN_TYPES.includes(painType) || intensity === null) {
      redirect(
        `/calendario?semana=${week}&error=` +
          encodeURIComponent(
            'La sesión se guardó, pero la molestia no: revisá el tipo y la intensidad.'
          )
      )
    }

    const { error: painError } = await supabase.from('pain_reports').insert({
      session_id: session!.id,
      zone_code: zone,
      pain_type: painType,
      intensity,
      reported_on: eventDate,
    })

    if (painError) {
      redirect(
        `/calendario?semana=${week}&error=` +
          encodeURIComponent('La sesión se guardó, pero no se pudo guardar la molestia.')
      )
    }

    painWarning = painType === 'agudo' || (intensity ?? 0) >= 6
  }

  revalidatePath('/calendario')

  let message = 'Sesión registrada'
  if (gymDay) message += ` (${gymDay})`
  if (efforts.length > 0) {
    message += ` con ${efforts.length} ${efforts.length === 1 ? 'repetición' : 'repeticiones'}`
  }
  if (gymExercises.length > 0) {
    message += ` con ${gymExercises.length} ${gymExercises.length === 1 ? 'ejercicio' : 'ejercicios'}`
  }
  message += '.'
  if (painWarning) {
    message +=
      ' Si la molestia es aguda o persiste, conviene que la evalúe un profesional antes de seguir con velocidad.'
  }

  redirect(`/calendario?semana=${week}&message=${encodeURIComponent(message)}`)
}