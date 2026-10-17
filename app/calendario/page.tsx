import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  addDays,
  dayLabel,
  isoDateInTZ,
  isValidISO,
  mondayOf,
  shortDate,
  timeInTZ,
  todayISO,
} from "@/lib/dates";
import { createEvent, deleteEvent } from "./actions";

type Params = Promise<{ semana?: string; error?: string; message?: string }>;

type CalEvent = {
  id: string;
  kind: string;
  title: string;
  starts_at: string;
  ends_at: string;
  is_planned_training: boolean;
  notes: string | null;
};

// Clases completas (Tailwind no detecta clases armadas dinamicamente)
const KINDS: Record<string, { label: string; badge: string }> = {
  track: { label: "Pista", badge: "bg-emerald-900 text-emerald-200" },
  gym: { label: "Gimnasio", badge: "bg-sky-900 text-sky-200" },
  daily_life: {
    label: "Vida diaria",
    badge: "bg-neutral-700 text-neutral-200",
  },
  competition: { label: "Competencia", badge: "bg-amber-900 text-amber-200" },
  other: { label: "Otro", badge: "bg-violet-900 text-violet-200" },
};

const inputClass =
  "w-full rounded-lg border border-neutral-700 bg-neutral-800 p-3 text-neutral-100";

// Todo lo que lee sesion o datos va dentro de Suspense, y empieza con connection()
async function Week({ searchParams }: { searchParams: Params }) {
  await connection();

  const { semana, error, message } = await searchParams;
  const today = todayISO();
  const monday = mondayOf(semana && isValidISO(semana) ? semana : today);
  const nextMonday = addDays(monday, 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const isCurrentWeek = monday === mondayOf(today);

  const supabase = await createClient();
  const { data, error: dbError } = await supabase
    .from("calendar_events")
    .select("id, kind, title, starts_at, ends_at, is_planned_training, notes")
    .gte("starts_at", `${monday}T00:00:00-03:00`)
    .lt("starts_at", `${nextMonday}T00:00:00-03:00`)
    .order("starts_at");

  const events = (data ?? []) as CalEvent[];

  // Competencias de la semana (solo lectura: se cargan desde la seccion Competencias)
  const { data: compData } = await supabase
    .from("competitions")
    .select("id, name, discipline, importance, event_date")
    .gte("event_date", monday)
    .lt("event_date", nextMonday)
    .order("event_date");
  const competitions = (compData ?? []) as {
    id: string;
    name: string;
    discipline: string;
    importance: string;
    event_date: string;
  }[];

  // Sesiones ya registradas para los eventos de esta semana (event_id -> RPE)
  const doneByEvent = new Map<string, number | null>();
  if (events.length > 0) {
    const { data: logs } = await supabase
      .from("session_logs")
      .select("event_id, rpe")
      .in(
        "event_id",
        events.map((e) => e.id),
      );
    for (const log of (logs ?? []) as {
      event_id: string | null;
      rpe: number | null;
    }[]) {
      if (log.event_id) doneByEvent.set(log.event_id, log.rpe);
    }
  }

  const byDay = new Map<string, CalEvent[]>();
  for (const ev of events) {
    const key = isoDateInTZ(ev.starts_at);
    byDay.set(key, [...(byDay.get(key) ?? []), ev]);
  }

  const defaultDate = days.includes(today) ? today : monday;

  return (
    <div className="space-y-4">
      {/* Navegacion de semana */}
      <div className="flex items-center justify-between">
        <Link
          href={`/calendario?semana=${addDays(monday, -7)}`}
          className="rounded-lg border border-neutral-700 px-3 py-2"
          aria-label="Semana anterior"
        >
          ←
        </Link>
        <div className="text-center">
          <p className="font-medium">
            {shortDate(monday)} – {shortDate(days[6])}
          </p>
          {!isCurrentWeek && (
            <Link
              href="/calendario"
              className="text-xs text-neutral-400 underline"
            >
              Ir a esta semana
            </Link>
          )}
        </div>
        <Link
          href={`/calendario?semana=${nextMonday}`}
          className="rounded-lg border border-neutral-700 px-3 py-2"
          aria-label="Semana siguiente"
        >
          →
        </Link>
      </div>

      {error && (
        <p className="rounded-lg bg-red-950 p-3 text-sm text-red-300">
          {error}
        </p>
      )}
      {message && (
        <p className="rounded-lg bg-emerald-950 p-3 text-sm text-emerald-300">
          {message}
        </p>
      )}
      {dbError && (
        <p className="rounded-lg bg-red-950 p-3 text-sm text-red-300">
          Error al cargar el calendario: {dbError.message}
        </p>
      )}

      {/* Formulario de nuevo evento */}
      <details className="rounded-xl bg-neutral-900 p-4">
        <summary className="cursor-pointer font-medium">+ Nuevo evento</summary>

        <form action={createEvent} className="mt-4 space-y-3">
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

          <label className="block space-y-1 text-sm">
            <span>Repetir semanalmente (cantidad de semanas)</span>
            <input
              type="number"
              name="repeat"
              min="1"
              max="26"
              defaultValue="1"
              className={inputClass}
            />
            <span className="block text-xs text-neutral-500">
              1 = solo esta vez. Ej: 8 lo carga el mismo día durante 8 semanas.
            </span>
          </label>

          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" name="planned" defaultChecked />
            <span>Es un entrenamiento planificado</span>
          </label>

          <textarea
            name="notes"
            rows={2}
            placeholder="Notas (opcional)"
            className={inputClass}
          />

          <button className="w-full rounded-lg bg-white p-3 font-medium text-black">
            Guardar evento
          </button>
        </form>
      </details>

      {/* Dias de la semana */}
      {days.map((day) => {
        const dayEvents = byDay.get(day) ?? [];
        const dayComps = competitions.filter((c) => c.event_date === day);
        const isToday = day === today;

        return (
          <section
            key={day}
            className={`rounded-xl p-4 ${
              isToday ? "bg-neutral-800 ring-1 ring-white/40" : "bg-neutral-900"
            }`}
          >
            <h2 className="mb-2 text-sm font-medium capitalize text-neutral-300">
              {dayLabel(day)}
              {isToday && (
                <span className="ml-2 text-xs text-neutral-400">hoy</span>
              )}
            </h2>

            {dayComps.map((c) => (
              <Link
                key={c.id}
                href="/competencias"
                className="mb-2 block rounded-lg border border-amber-700 bg-amber-950/50 p-3 text-sm text-amber-200"
              >
                🏁 {c.name}
                {c.discipline !== "otra" &&
                  ` · ${c.discipline.replace("m", " m")}`}
                {` · Importancia ${c.importance}`}
              </Link>
            ))}

            {dayEvents.length === 0 ? (
              dayComps.length === 0 ? (
                <p className="text-sm text-neutral-600">Sin eventos</p>
              ) : null
            ) : (
              <ul className="space-y-2">
                {dayEvents.map((ev) => {
                  const kind = KINDS[ev.kind] ?? KINDS.other;
                  return (
                    <li
                      key={ev.id}
                      className="flex items-start justify-between gap-3 rounded-lg bg-neutral-950 p-3"
                    >
                      <div className="min-w-0 space-y-1">
                        <p className="text-xs text-neutral-400">
                          {timeInTZ(ev.starts_at)} – {timeInTZ(ev.ends_at)}
                        </p>
                        <p className="font-medium">{ev.title}</p>
                        <div className="flex flex-wrap gap-2 text-xs">
                          <span
                            className={`rounded-full px-2 py-0.5 ${kind.badge}`}
                          >
                            {kind.label}
                          </span>
                          {ev.is_planned_training && (
                            <span className="rounded-full border border-neutral-600 px-2 py-0.5 text-neutral-300">
                              Entreno planificado
                            </span>
                          )}
                        </div>
                        {ev.notes && (
                          <p className="text-sm text-neutral-400">{ev.notes}</p>
                        )}
                        {ev.is_planned_training &&
                          (doneByEvent.has(ev.id) ? (
                            <p className="pt-1 text-sm text-emerald-400">
                              ✓ Registrada
                              {doneByEvent.get(ev.id) != null &&
                                ` · RPE ${doneByEvent.get(ev.id)}`}
                            </p>
                          ) : (
                            <Link
                              href={`/sesion/${ev.id}`}
                              className="mt-1 inline-block rounded-lg bg-white px-4 py-2 text-sm font-medium text-black"
                            >
                              Terminé
                            </Link>
                          ))}
                      </div>

                      <form action={deleteEvent}>
                        <input type="hidden" name="id" value={ev.id} />
                        <input type="hidden" name="semana" value={monday} />
                        <button
                          aria-label={`Borrar ${ev.title}`}
                          className="rounded-lg px-2 py-1 text-neutral-500 hover:text-red-400"
                        >
                          ✕
                        </button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

export default function CalendarioPage({
  searchParams,
}: {
  searchParams: Params;
}) {
  return (
    <main className="min-h-screen bg-neutral-950 p-6 text-neutral-100">
      <div className="mx-auto max-w-md space-y-4">
        <Link href="/" className="text-sm text-neutral-400">
          ← Inicio
        </Link>
        <h1 className="text-2xl font-semibold">Calendario</h1>

        <Suspense fallback={<p className="text-neutral-400">Cargando…</p>}>
          <Week searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}
