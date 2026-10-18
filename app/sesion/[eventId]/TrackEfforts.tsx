'use client'

import { useState } from 'react'

type Row = {
  id: number
  distance: string
  time: string
  rest: string
  wind: string
}

const MAX_ROWS = 40

const inputClass =
  'w-full rounded-lg border border-neutral-700 bg-neutral-800 p-3 text-neutral-100'

// Los inputs se envian con el formulario del servidor: cada fila aporta un valor
// a e_distance, e_time, e_rest y e_wind (en el mismo orden).
export default function TrackEfforts({ defaultDistance }: { defaultDistance: number }) {
  const [rows, setRows] = useState<Row[]>([
    { id: 1, distance: String(defaultDistance), time: '', rest: '', wind: '' },
  ])
  const [nextId, setNextId] = useState(2)

  function update(id: number, field: keyof Omit<Row, 'id'>, value: string) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [field]: value } : r)))
  }

  function addRow() {
    if (rows.length >= MAX_ROWS) return
    const last = rows[rows.length - 1]
    // La nueva fila copia distancia y descanso de la anterior
    setRows([
      ...rows,
      {
        id: nextId,
        distance: last?.distance ?? String(defaultDistance),
        time: '',
        rest: last?.rest ?? '',
        wind: '',
      },
    ])
    setNextId(nextId + 1)
  }

  function removeRow(id: number) {
    setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.id !== id) : rs))
  }

  return (
    <div className="space-y-3">
      {rows.map((row, index) => (
        <div key={row.id} className="space-y-2 rounded-xl bg-neutral-900 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Rep {index + 1}</span>
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => removeRow(row.id)}
                aria-label={`Quitar repetición ${index + 1}`}
                className="px-2 text-neutral-500 hover:text-red-400"
              >
                ✕
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1 text-xs text-neutral-400">
              <span>Distancia (m)</span>
              <input
                type="number"
                inputMode="numeric"
                name="e_distance"
                min="10"
                max="1000"
                value={row.distance}
                onChange={(e) => update(row.id, 'distance', e.target.value)}
                required={row.time.trim() !== ''}
                className={inputClass}
              />
            </label>

            <label className="space-y-1 text-xs text-neutral-400">
              <span>Tiempo (s)</span>
              <input
                type="text"
                inputMode="decimal"
                name="e_time"
                placeholder="10.85"
                pattern="(\d{1,2}:\d{2}|\d{1,3})([.,]\d{1,3})?"
                title="Ej: 10.85 o 1:02.30"
                value={row.time}
                onChange={(e) => update(row.id, 'time', e.target.value)}
                className={inputClass}
              />
            </label>

            <label className="space-y-1 text-xs text-neutral-400">
              <span>Descanso (min)</span>
              <input
                type="number"
                inputMode="decimal"
                name="e_rest"
                min="0"
                max="120"
                step="0.5"
                value={row.rest}
                onChange={(e) => update(row.id, 'rest', e.target.value)}
                className={inputClass}
              />
            </label>

            <label className="space-y-1 text-xs text-neutral-400">
              <span>Viento (m/s)</span>
              <input
                type="number"
                inputMode="decimal"
                name="e_wind"
                min="-10"
                max="10"
                step="0.1"
                placeholder="+1.2"
                value={row.wind}
                onChange={(e) => update(row.id, 'wind', e.target.value)}
                className={inputClass}
              />
            </label>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addRow}
        disabled={rows.length >= MAX_ROWS}
        className="w-full rounded-lg border border-neutral-600 p-3 text-sm font-medium disabled:opacity-40"
      >
        + Agregar repetición
      </button>
    </div>
  )
}
