import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { dayLabel, isoDateInTZ, mondayOf, timeInTZ } from "@/lib/dates";
import { saveSession } from "../actions";

type Params = Promise<{ eventId: string }>;
type Search = Promise<{ error?: string }>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const FEELINGS = [
  { value: 1, emoji: "😫", label: "Muy mal" },
  { value: 2, emoji: "😕", label: "Mal" },
  { value: 3, emoji: "😐", label: "Normal" },
  { value: 4, emoji: "🙂", label: "Bien" },
  { value: 5, emoji: "💪", label: "Excelente" },
];

const PAIN_TYPES = [
  { value: "tiron", label: "Tirón" },
  { value: "agudo", label: "Dolor agudo" },
  { value: "carga_muscular", label: "Carga muscular" },
  { value: "articular", label: "Articular" },
  { value: "otro", label: "Otro" },
];

const inputClass =
  "w-full rounded-lg border border-neutral-700 bg-neutral-800 p-3 text-neutral-100";

const choiceClass =
  "flex items-center justify-center rounded-lg border border-neutral-700 bg-neutral-800 " +
  "peer-checked:border-white peer-checked:bg-white peer-checked:text-black " +
  "peer-focus-visible:ring-2 peer-focus-visible:ring-white";

// Todo lo que lee sesion o datos va dentro de Suspense, y empieza con connection()
async function SessionForm({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  await connection();

  const { eventId } = await params;
  const { error } = await searchParams;
  if (!UUID.test(eventId)) notFound();

  const supabase = await createClient();

  const { data: event } = await supabase
    .from("calendar_events")
    .select("id, title, kind, starts_at, ends_at")
    .eq("id", eventId)
    .maybeSingle();

  if (!event) notFound();

  const { data: zones } = await supabase
    .from("body_zones")
    .select("code, label")
    .order("label");

  const date = isoDateInTZ(event.starts_at);
  const plannedMinutes = Math.max(
    1,
    Math.round(
      (new Date(event.ends_at).getTime() -
        new Date(event.starts_at).getTime()) /
        60000,
    ),
  );

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm capitalize text-neutral-400">
          {dayLabel(date)} · {timeInTZ(event.starts_at)} –{" "}
          {timeInTZ(event.ends_at)}
        </p>
        <h2 className="text-xl font-semibold">{event.title}</h2>
      </div>

      {error && (
        <p className="rounded-lg bg-red-950 p-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <form action={saveSession} className="space-y-6">
        <input type="hidden" name="event_id" value={event.id} />

        {/* RPE */}
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">
            ¿Qué tan duro fue? (esfuerzo)
          </legend>
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <label key={n} className="cursor-pointer">
                <input
                  type="radio"
                  name="rpe"
                  value={n}
                  required
                  className="peer sr-only"
                />
                <span className={`${choiceClass} h-12 text-lg`}>{n}</span>
              </label>
            ))}
          </div>
          <p className="flex justify-between text-xs text-neutral-500">
            <span>1 = muy suave</span>
            <span>10 = máximo</span>
          </p>
        </fieldset>

        {/* Sensacion */}
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">¿Cómo te sentiste?</legend>
          <div className="grid grid-cols-5 gap-2">
            {FEELINGS.map((f) => (
              <label key={f.value} className="cursor-pointer">
                <input
                  type="radio"
                  name="feeling"
                  value={f.value}
                  required
                  className="peer sr-only"
                />
                <span className={`${choiceClass} h-14 flex-col text-xl`}>
                  {f.emoji}
                  <span className="text-[10px] leading-tight">{f.label}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Duracion */}
        <label className="block space-y-1">
          <span className="text-sm font-medium">Duración (minutos)</span>
          <input
            type="number"
            inputMode="numeric"
            name="duration_min"
            min="1"
            max="600"
            required
            defaultValue={plannedMinutes}
            className={inputClass}
          />
          <span className="block text-xs text-neutral-500">
            Viene del calendario. Cambialo si fue distinto.
          </span>
        </label>

        {/* Molestia */}
        <details className="rounded-xl bg-neutral-900 p-4">
          <summary className="cursor-pointer text-sm font-medium">
            ¿Alguna molestia? (opcional)
          </summary>

          <div className="mt-4 space-y-3">
            <select name="pain_zone" defaultValue="" className={inputClass}>
              <option value="">Sin molestias</option>
              {(zones ?? []).map((z) => (
                <option key={z.code} value={z.code}>
                  {z.label}
                </option>
              ))}
            </select>

            <select
              name="pain_type"
              defaultValue="carga_muscular"
              className={inputClass}
            >
              {PAIN_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>

            <label className="block space-y-1 text-sm">
              <span>Intensidad (0 a 10)</span>
              <input
                type="number"
                inputMode="numeric"
                name="pain_intensity"
                min="0"
                max="10"
                defaultValue="3"
                className={inputClass}
              />
            </label>

            <p className="text-xs text-neutral-500">
              Solo se guarda si elegís una zona. Si el dolor es agudo, empeora o
              dura más de unos días, consultá a un profesional.
            </p>
          </div>
        </details>

        {/* Nota */}
        <textarea
          name="notes"
          rows={2}
          placeholder="Nota (opcional)"
          className={inputClass}
        />

        <button className="w-full rounded-lg bg-white p-4 text-lg font-medium text-black">
          Guardar sesión
        </button>
      </form>

      <Link
        href={`/calendario?semana=${mondayOf(date)}`}
        className="block text-center text-sm text-neutral-400"
      >
        Cancelar
      </Link>
    </div>
  );
}

export default function SesionPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  return (
    <main className="min-h-screen bg-neutral-950 p-6 text-neutral-100">
      <div className="mx-auto max-w-md space-y-4">
        <h1 className="text-2xl font-semibold">Terminé</h1>

        <Suspense fallback={<p className="text-neutral-400">Cargando…</p>}>
          <SessionForm params={params} searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}
