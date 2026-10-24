import Link from 'next/link'
import { dayLabel, timeInTZ } from '@/lib/dates'

// Los formularios no llaman al servidor directamente: reciben funciones del calendario, que
// primero muestran el cambio al instante y despues lo guardan (ver CalendarClient).
export type FormAction = (formData: FormData) => void | Promise<void>

export type CalEvent = {
  id: string
  kind: string
  title: string
  starts_at: string
  ends_at: string
  is_planned_training: boolean
  notes: string | null
  series_id: string | null
}

export type CalComp = {
  id: string
  name: string
  discipline: string
  importance: string
  event_date: string
}

// Clases completas (Tailwind no detecta clases armadas dinamicamente)
export const KINDS: Record<string, { label: string; badge: string; dot: string }> = {
  track: { label: 'Pista', badge: 'bg-brand-soft text-brand-fg', dot: 'bg-brand-fg' },
  gym: { label: 'Gimnasio', badge: 'bg-neutral-800 text-neutral-100', dot: 'bg-neutral-100' },
  daily_life: {
    label: 'Vida diaria',
    badge: 'bg-neutral-800 text-neutral-400',
    dot: 'bg-neutral-500',
  },
  competition: { label: 'Competencia', badge: 'bg-amber-900 text-amber-200', dot: 'bg-gold' },
  other: { label: 'Otro', badge: 'bg-violet-900 text-violet-200', dot: 'bg-neutral-400' },
}

const inputClass =
  'w-full rounded-xl border border-neutral-700 bg-neutral-800 p-3 text-neutral-100'

// A que eventos de una serie se aplica una edicion o un borrado
const SCOPES = [
  { value: 'this', label: 'Solo este evento' },
  { value: 'following', label: 'Este y los siguientes' },
  { value: 'all', label: 'Toda la serie' },
]

function ScopeRadios({ legend }: { legend: string }) {
  return (
    <fieldset className="min-w-0 space-y-2">
      <legend className="text-xs text-neutral-400">{legend}</legend>
      {SCOPES.map((s) => (
        <label key={s.value} className="flex items-center gap-3">
          <input
            type="radio"
            name="scope"
            value={s.value}
            defaultChecked={s.value === 'this'}
            className="h-4 w-4 accent-[var(--brand)]"
          />
          <span>{s.label}</span>
        </label>
      ))}
    </fieldset>
  )
}

// 0 = lunes ... 6 = domingo (el servidor usa los mismos numeros)
const WEEKDAY_CHIPS = [
  { value: 0, short: 'L', full: 'Lunes' },
  { value: 1, short: 'M', full: 'Martes' },
  { value: 2, short: 'X', full: 'Miércoles' },
  { value: 3, short: 'J', full: 'Jueves' },
  { value: 4, short: 'V', full: 'Viernes' },
  { value: 5, short: 'S', full: 'Sábado' },
  { value: 6, short: 'D', full: 'Domingo' },
]

// Un dia con sus eventos y competencias (se usa en la semana y en el detalle del mes)
export function DayBlock({
  day,
  today,
  events,
  comps,
  doneByEvent,
  onUpdate,
  onDelete,
  animateIn = false,
}: {
  day: string
  today: string
  events: CalEvent[]
  comps: CalComp[]
  doneByEvent: Map<string, number | null>
  onUpdate: FormAction
  onDelete: FormAction
  animateIn?: boolean
}) {
  const isToday = day === today

  return (
    <section
      className={`rounded-2xl p-4 ${
        isToday ? 'bg-neutral-900 ring-1 ring-brand' : 'bg-neutral-900'
      } ${animateIn ? 'enter' : ''}`}
    >
      <h2 className="mb-2 text-sm font-semibold capitalize text-neutral-300">
        {dayLabel(day)}
        {isToday && (
          <span className="ml-2 rounded-full bg-brand px-2 py-0.5 text-[11px] font-medium normal-case text-on-brand">
            hoy
          </span>
        )}
      </h2>

      {comps.map((c) => (
        <Link
          key={c.id}
          href="/competencias"
          className="mb-2 block rounded-xl border border-amber-700 bg-amber-950/50 p-3 text-sm font-medium text-amber-200"
        >
          🏁 {c.name}
          {c.discipline !== 'otra' && `, ${c.discipline.replace('m', ' m')}`}
          {`, importancia ${c.importance}`}
        </Link>
      ))}

      {events.length === 0 ? (
        comps.length === 0 ? (
          <p className="text-sm text-neutral-500">Sin eventos</p>
        ) : null
      ) : (
        <ul className="space-y-2">
          {events.map((ev) => {
            const kind = KINDS[ev.kind] ?? KINDS.other
            const done = doneByEvent.has(ev.id)
            const rpe = doneByEvent.get(ev.id)
            // Un evento recien creado, que el servidor todavia esta guardando
            const pending = ev.id.startsWith('tmp-')

            return (
              <li key={ev.id} className="rounded-xl bg-neutral-950 p-3">
                <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="text-xs text-neutral-400">
                    {timeInTZ(ev.starts_at)} a {timeInTZ(ev.ends_at)}
                  </p>
                  <p className="font-semibold">{ev.title}</p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className={`rounded-full px-2 py-0.5 ${kind.badge}`}>
                      {kind.label}
                    </span>
                    {ev.is_planned_training && (
                      <span className="rounded-full border border-neutral-600 px-2 py-0.5 text-neutral-300">
                        Entreno planificado
                      </span>
                    )}
                    {ev.series_id && (
                      <span className="rounded-full border border-neutral-600 px-2 py-0.5 text-neutral-300">
                        Serie
                      </span>
                    )}
                  </div>
                  {ev.notes && <p className="text-sm text-neutral-400">{ev.notes}</p>}
                  {pending && <p className="text-xs text-neutral-500">Guardando…</p>}

                  {ev.is_planned_training &&
                    !pending &&
                    (done ? (
                      <p className="pt-1 text-sm font-medium text-emerald-300">
                        ✓ Registrada{rpe != null && `, RPE ${rpe}`}
                      </p>
                    ) : (
                      <Link
                        href={`/sesion/${ev.id}`}
                        className="mt-1 inline-block rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-on-brand"
                      >
                        Terminé
                      </Link>
                    ))}
                </div>

                {/* Los eventos de una serie se borran desde "Editar", donde se elige el alcance */}
                {!ev.series_id && !pending && (
                  <form action={onDelete}>
                    <input type="hidden" name="id" value={ev.id} />
                    <button
                      aria-label={`Borrar ${ev.title}`}
                      className="rounded-lg px-2 py-1 text-neutral-500 hover:text-red-400"
                    >
                      ✕
                    </button>
                  </form>
                )}
                </div>

                {!pending && (
                <details className="mt-2 text-sm">
                  <summary className="cursor-pointer text-neutral-400">Editar</summary>

                  <form action={onUpdate} className="mt-3 space-y-3">
                    <input type="hidden" name="id" value={ev.id} />

                    <input
                      name="title"
                      required
                      defaultValue={ev.title}
                      aria-label="Título"
                      className={inputClass}
                    />

                    <select
                      name="kind"
                      defaultValue={ev.kind}
                      disabled={done}
                      aria-label="Tipo de evento"
                      className={`${inputClass} disabled:opacity-60`}
                    >
                      {Object.entries(KINDS).map(([value, k]) => (
                        <option key={value} value={value}>
                          {k.label}
                        </option>
                      ))}
                    </select>

                    <input
                      type="date"
                      name="date"
                      required
                      defaultValue={day}
                      aria-label="Fecha"
                      className={inputClass}
                    />

                    <div className="grid grid-cols-2 gap-3">
                      <label className="space-y-1 text-xs text-neutral-400">
                        <span>Inicio</span>
                        <input
                          type="time"
                          name="start"
                          required
                          defaultValue={timeInTZ(ev.starts_at)}
                          className={inputClass}
                        />
                      </label>
                      <label className="space-y-1 text-xs text-neutral-400">
                        <span>Fin</span>
                        <input
                          type="time"
                          name="end"
                          required
                          defaultValue={timeInTZ(ev.ends_at)}
                          className={inputClass}
                        />
                      </label>
                    </div>

                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        name="planned"
                        defaultChecked={ev.is_planned_training}
                        disabled={done}
                        className="h-4 w-4 accent-[var(--brand)]"
                      />
                      <span>Es un entrenamiento planificado</span>
                    </label>

                    <textarea
                      name="notes"
                      rows={2}
                      defaultValue={ev.notes ?? ''}
                      placeholder="Notas (opcional)"
                      aria-label="Notas"
                      className={inputClass}
                    />

                    {done && (
                      <p className="text-xs text-neutral-500">
                        Esta sesión ya está registrada. El tipo no se puede cambiar, y si
                        cambiás el día o la hora, el registro se mueve con el evento.
                      </p>
                    )}

                    {ev.series_id && (
                      <div className="space-y-2 rounded-xl bg-neutral-900 p-3">
                        <ScopeRadios legend="Aplicar los cambios a" />
                        <p className="text-xs text-neutral-500">
                          Si cambiás el día, solo se mueven los eventos que caen el mismo día
                          de la semana que este (por ejemplo, todos los martes). Los demás
                          días de la serie no se tocan. Los eventos que ya tienen una sesión
                          registrada tampoco se modifican.
                        </p>
                      </div>
                    )}

                    <button className="w-full rounded-xl bg-brand p-3 font-semibold text-on-brand">
                      Guardar cambios
                    </button>
                  </form>

                  {ev.series_id && (
                    <form
                      action={onDelete}
                      className="mt-4 space-y-3 border-t border-neutral-700 pt-4"
                    >
                      <input type="hidden" name="id" value={ev.id} />
                      <ScopeRadios legend="Borrar" />
                      <p className="text-xs text-neutral-500">
                        Los eventos que ya tienen una sesión registrada no se borran, para no
                        perder tu historial.
                      </p>
                      <button className="font-medium text-red-400">Borrar</button>
                    </form>
                  )}
                </details>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export function NewEventForm({
  defaultDate,
  onCreate,
}: {
  defaultDate: string
  onCreate: FormAction
}) {
  return (
    <details className="rounded-2xl bg-neutral-900 p-4">
      <summary className="cursor-pointer font-semibold">+ Nuevo evento</summary>

      <form action={onCreate} className="mt-4 space-y-3">

        <input
          name="title"
          required
          placeholder="Título (ej: Series 6x60 m)"
          className={inputClass}
        />

        <select name="kind" defaultValue="track" className={inputClass}>
          {Object.entries(KINDS).map(([value, k]) => (
            <option key={value} value={value}>
              {k.label}
            </option>
          ))}
        </select>

        <input
          type="date"
          name="date"
          required
          defaultValue={defaultDate}
          className={inputClass}
        />

        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1 text-sm">
            <span>Inicio</span>
            <input
              type="time"
              name="start"
              required
              defaultValue="18:00"
              className={inputClass}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span>Fin</span>
            <input
              type="time"
              name="end"
              required
              defaultValue="19:30"
              className={inputClass}
            />
          </label>
        </div>

        <fieldset className="min-w-0 space-y-2">
          <legend className="text-sm">Días de la semana</legend>
          <div className="grid grid-cols-7 gap-1.5">
            {WEEKDAY_CHIPS.map((d) => (
              <label key={d.value} className="cursor-pointer">
                <input
                  type="checkbox"
                  name="days"
                  value={d.value}
                  aria-label={d.full}
                  className="peer sr-only"
                />
                <span className="flex h-11 items-center justify-center rounded-lg border border-neutral-700 bg-neutral-800 text-sm font-medium transition-colors duration-150 peer-checked:border-brand peer-checked:bg-brand peer-checked:text-on-brand peer-focus-visible:ring-2 peer-focus-visible:ring-brand">
                  {d.short}
                </span>
              </label>
            ))}
          </div>
          <p className="text-xs text-neutral-500">
            Marcá uno o más días. Si no marcás ninguno, se usa el día de la fecha elegida.
          </p>
        </fieldset>

        <label className="block space-y-1 text-sm">
          <span>Repetir durante (semanas)</span>
          <input
            type="number"
            name="repeat"
            min="1"
            max="26"
            defaultValue="1"
            className={inputClass}
          />
          <span className="block text-xs text-neutral-500">
            Cuenta la semana de la fecha elegida. Con 8 y los días martes y sábado, se cargan
            ambos durante 8 semanas seguidas, desde la fecha de inicio.
          </span>
        </label>

        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" name="planned" defaultChecked className="h-4 w-4 accent-[var(--brand)]" />
          <span>Es un entrenamiento planificado</span>
        </label>

        <textarea
          name="notes"
          rows={2}
          placeholder="Notas (opcional)"
          className={inputClass}
        />

        <button className="w-full rounded-xl bg-brand p-3.5 font-semibold text-on-brand">
          Guardar evento
        </button>
      </form>
    </details>
  )
}
