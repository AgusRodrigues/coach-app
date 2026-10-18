'use client'

import { useState } from 'react'
import type { CatalogItem, DayHistory, HistSet } from '@/lib/gym-history'

type SetRow = { reps: string; load: string }
type Ex = { key: number; exerciseId: string | null; name: string; sets: SetRow[] }

type Props = {
  days: DayHistory[]
  catalog: CatalogItem[]
  lastByExercise: Record<string, HistSet[]>
  suggestedDay: string
}

const CATEGORY_LABELS: Record<string, string> = {
  fuerza_inferior: 'Fuerza inferior',
  fuerza_superior: 'Fuerza superior',
  potencia: 'Potencia',
  pliometria: 'Pliometría',
  isquiotibiales: 'Isquiotibiales',
  core: 'Core',
  movilidad: 'Movilidad',
  otro: 'Otros',
}

// Sugerencias para la primera vez, cuando todavia no hay historial
const FALLBACK_DAYS = ['Día A', 'Día B', 'Piernas', 'Tren superior']

const inputClass =
  'w-full rounded-lg border border-neutral-700 bg-neutral-800 p-3 text-neutral-100'
const cellClass =
  'w-full min-w-0 rounded-lg border border-neutral-700 bg-neutral-800 p-2 text-center text-neutral-100'

function toRows(sets: HistSet[]): SetRow[] {
  return sets.map((s) => ({ reps: String(s.reps), load: s.load ? String(s.load) : '' }))
}

function defaultRows(): SetRow[] {
  return [1, 2, 3].map(() => ({ reps: '8', load: '' }))
}

// Funcion pura: las claves salen de startKey, sin tocar ningun valor externo
function fromDay(d: DayHistory, startKey: number): Ex[] {
  return d.exercises.map((e, i) => ({
    key: startKey + i,
    exerciseId: e.exerciseId,
    name: e.name,
    sets: toRows(e.sets),
  }))
}

// Los datos se envian al servidor como JSON en un campo oculto (gym_payload).
// El servidor vuelve a validar todo: nada de lo que viene de aca se da por bueno.
export default function GymEditor({ days, catalog, lastByExercise, suggestedDay }: Props) {
  const initial = days.find((d) => d.label === suggestedDay)

  const [day, setDay] = useState(initial?.label ?? '')
  const [customDay, setCustomDay] = useState('')
  const [exs, setExs] = useState<Ex[]>(() => (initial ? fromDay(initial, 1) : []))
  // Proxima clave libre para identificar ejercicios en la lista
  const [nextKey, setNextKey] = useState(initial ? initial.exercises.length + 1 : 1)
  const [dirty, setDirty] = useState(false)
  const [newName, setNewName] = useState('')

  function edit(updater: (list: Ex[]) => Ex[]) {
    setExs(updater)
    setDirty(true)
  }

  function selectDay(label: string) {
    const hist = days.find((d) => d.label === label)
    if (hist) {
      if (dirty && !window.confirm('Vas a reemplazar los ejercicios que cargaste. ¿Seguís?')) {
        return
      }
      setExs(fromDay(hist, nextKey))
      setNextKey(nextKey + hist.exercises.length)
      setDirty(false)
    }
    setDay(label)
    setCustomDay('')
  }

  function updateSet(key: number, index: number, field: keyof SetRow, value: string) {
    edit((list) =>
      list.map((e) =>
        e.key !== key
          ? e
          : { ...e, sets: e.sets.map((s, i) => (i === index ? { ...s, [field]: value } : s)) }
      )
    )
  }

  function addSet(key: number) {
    edit((list) =>
      list.map((e) => {
        if (e.key !== key) return e
        const last = e.sets[e.sets.length - 1]
        return { ...e, sets: [...e.sets, last ? { ...last } : { reps: '8', load: '' }] }
      })
    )
  }

  function removeSet(key: number, index: number) {
    edit((list) =>
      list.map((e) =>
        e.key !== key || e.sets.length <= 1
          ? e
          : { ...e, sets: e.sets.filter((_, i) => i !== index) }
      )
    )
  }

  function move(key: number, dir: -1 | 1) {
    edit((list) => {
      const i = list.findIndex((e) => e.key === key)
      const j = i + dir
      if (i < 0 || j < 0 || j >= list.length) return list
      const copy = [...list]
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
      return copy
    })
  }

  function removeExercise(key: number) {
    edit((list) => list.filter((e) => e.key !== key))
  }

  function addFromCatalog(item: CatalogItem) {
    const key = nextKey
    setNextKey(nextKey + 1)
    const last = lastByExercise[item.id]
    edit((list) => [
      ...list,
      {
        key,
        exerciseId: item.id,
        name: item.name,
        sets: last ? toRows(last) : defaultRows(),
      },
    ])
  }

  function addNewExercise() {
    const name = newName.trim()
    if (!name) return

    const existing = catalog.find((c) => c.name.toLowerCase() === name.toLowerCase())
    if (existing) {
      if (!exs.some((e) => e.exerciseId === existing.id)) addFromCatalog(existing)
    } else if (!exs.some((e) => !e.exerciseId && e.name.toLowerCase() === name.toLowerCase())) {
      const key = nextKey
      setNextKey(nextKey + 1)
      edit((list) => [...list, { key, exerciseId: null, name, sets: defaultRows() }])
    }
    setNewName('')
  }

  const chipLabels = days.length > 0 ? days.map((d) => d.label) : FALLBACK_DAYS
  const loadedFromHistory = days.some((d) => d.label === day) && !dirty

  const available = catalog.filter((c) => !exs.some((e) => e.exerciseId === c.id))
  const groups = Object.entries(CATEGORY_LABELS)
    .map(([cat, label]) => ({
      cat,
      label,
      items: available.filter((c) => c.category === cat),
    }))
    .filter((g) => g.items.length > 0)

  const payload = JSON.stringify({
    day,
    exercises: exs.map((e) => ({
      exercise_id: e.exerciseId,
      new_name: e.exerciseId ? null : e.name,
      sets: e.sets.map((s) => ({ reps: s.reps, load: s.load })),
    })),
  })

  return (
    <div className="space-y-4">
      <input type="hidden" name="gym_payload" value={payload} />

      {/* Dia de rutina */}
      <div className="space-y-2">
        <p className="text-sm font-medium">¿Qué día es?</p>
        <div className="flex flex-wrap gap-2">
          {chipLabels.map((label) => (
            <button
              key={label}
              type="button"
              aria-pressed={day === label}
              onClick={() => selectDay(label)}
              className={`rounded-full border px-4 py-2 text-sm ${
                day === label
                  ? 'border-brand bg-brand text-on-brand'
                  : 'border-neutral-600 text-neutral-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          value={customDay}
          onChange={(e) => {
            setCustomDay(e.target.value)
            setDay(e.target.value.trim())
          }}
          maxLength={40}
          placeholder="Otro día (ej: Día C, Hombros)"
          className={inputClass}
        />
        {loadedFromHistory && (
          <p className="text-xs text-neutral-500">
            Cargué lo último que hiciste en «{day}». Cambiá solo lo que haga falta.
          </p>
        )}
      </div>

      {/* Ejercicios */}
      {exs.length === 0 && (
        <p className="rounded-lg bg-neutral-900 p-3 text-sm text-neutral-500">
          Todavía no hay ejercicios. Elegí un día con historial o agregalos abajo.
        </p>
      )}

      {exs.map((ex, exIndex) => (
        <div key={ex.key} className="space-y-2 rounded-xl bg-neutral-900 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0 truncate font-medium">{ex.name}</p>
            <div className="flex shrink-0 items-center">
              <button
                type="button"
                onClick={() => move(ex.key, -1)}
                disabled={exIndex === 0}
                aria-label={`Subir ${ex.name}`}
                className="px-2 py-1 text-neutral-400 disabled:opacity-30"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={() => move(ex.key, 1)}
                disabled={exIndex === exs.length - 1}
                aria-label={`Bajar ${ex.name}`}
                className="px-2 py-1 text-neutral-400 disabled:opacity-30"
              >
                ▼
              </button>
              <button
                type="button"
                onClick={() => removeExercise(ex.key)}
                aria-label={`Quitar ${ex.name}`}
                className="px-2 py-1 text-neutral-500 hover:text-red-400"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="grid grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)_2rem] items-center gap-2 text-xs text-neutral-500">
            <span />
            <span className="text-center">Reps</span>
            <span className="text-center">Kg</span>
            <span />
          </div>

          {ex.sets.map((s, i) => (
            <div key={i} className="grid grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)_2rem] items-center gap-2">
              <span className="text-center text-sm text-neutral-500">{i + 1}</span>
              <input
                type="number"
                inputMode="numeric"
                min="1"
                max="200"
                required
                value={s.reps}
                onChange={(e) => updateSet(ex.key, i, 'reps', e.target.value)}
                aria-label={`Repeticiones, serie ${i + 1} de ${ex.name}`}
                className={cellClass}
              />
              <input
                type="number"
                inputMode="decimal"
                min="0"
                max="1000"
                step="0.25"
                placeholder="peso corporal"
                value={s.load}
                onChange={(e) => updateSet(ex.key, i, 'load', e.target.value)}
                aria-label={`Kilos, serie ${i + 1} de ${ex.name}`}
                className={`${cellClass} placeholder:text-[10px]`}
              />
              <button
                type="button"
                onClick={() => removeSet(ex.key, i)}
                disabled={ex.sets.length <= 1}
                aria-label={`Quitar serie ${i + 1} de ${ex.name}`}
                className="text-neutral-500 hover:text-red-400 disabled:opacity-20"
              >
                ✕
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={() => addSet(ex.key)}
            className="w-full rounded-lg border border-neutral-700 p-2 text-sm text-neutral-300"
          >
            + Serie
          </button>
        </div>
      ))}

      {/* Agregar ejercicio */}
      <div className="space-y-2 rounded-xl border border-dashed border-neutral-700 p-3">
        <p className="text-sm font-medium">Agregar ejercicio</p>

        <select
          value=""
          onChange={(e) => {
            const item = catalog.find((c) => c.id === e.target.value)
            if (item) addFromCatalog(item)
          }}
          className={inputClass}
        >
          <option value="">Elegir de la lista…</option>
          {groups.map((g) => (
            <optgroup key={g.cat} label={g.label}>
              {g.items.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>

        <div className="flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addNewExercise()
              }
            }}
            maxLength={60}
            placeholder="¿No está? Escribí el nombre"
            className={`${inputClass} min-w-0`}
          />
          <button
            type="button"
            onClick={addNewExercise}
            className="shrink-0 rounded-lg border border-neutral-600 px-4 text-sm"
          >
            Crear
          </button>
        </div>
        <p className="text-xs text-neutral-500">
          Si lo agregás de la lista, trae los kilos de la última vez que lo hiciste.
        </p>
      </div>
    </div>
  )
}
