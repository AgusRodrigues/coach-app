import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { todayISO } from "@/lib/dates";
import { logout } from "./login/actions";

// Lee las cookies de sesion dentro de Suspense (requisito de Next.js con Cache Components)
async function UserInfo() {
  // Las llamadas de auth leen Date.now() para chequear si la sesion vencio.
  // connection() avisa a Next.js que este componente depende de cada peticion.
  // Tiene que ir ANTES de crear el cliente y con await.
  await connection();

  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const email = claimsData?.claims?.email;

  // Prueba de seguridad: gracias a RLS, esto solo devuelve TU perfil
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .maybeSingle();

  // Check-in de hoy: hecho o pendiente (RLS: solo ve los propios)
  const { data: todayCheckin } = await supabase
    .from("daily_checkins")
    .select("id")
    .eq("checkin_date", todayISO())
    .maybeSingle();

  // Molestias activas (sin fecha de resolucion)
  const { count: activePain } = await supabase
    .from("pain_reports")
    .select("id", { count: "exact", head: true })
    .is("resolved_on", null);
  const painCount = activePain ?? 0;

  return (
    <>
      <h1 className="text-2xl font-semibold">Sesión iniciada</h1>
      <p className="text-neutral-400">{email}</p>

      <div className="rounded-xl bg-neutral-900 p-4 text-sm">
        <p className="mb-2 font-medium">Tu fila en profiles:</p>
        {error ? (
          <p className="text-red-400">Error: {error.message}</p>
        ) : (
          <pre className="overflow-x-auto text-neutral-300">
            {JSON.stringify(profile, null, 2)}
          </pre>
        )}
      </div>

      {todayCheckin ? (
        <Link
          href="/checkin"
          className="block rounded-lg border border-emerald-700 p-3 text-center font-medium text-emerald-300"
        >
          ✓ Check-in de hoy hecho (editar)
        </Link>
      ) : (
        <Link
          href="/checkin"
          className="block rounded-lg bg-amber-200 p-3 text-center font-medium text-black"
        >
          Check-in de la mañana
        </Link>
      )}

      <Link
        href="/calendario"
        className="block rounded-lg bg-white p-3 text-center font-medium text-black"
      >
        Calendario
      </Link>

      <Link
        href="/progreso"
        className="block rounded-lg bg-white p-3 text-center font-medium text-black"
      >
        Progreso
      </Link>

      <Link
        href="/competencias"
        className="block rounded-lg border border-neutral-600 p-3 text-center font-medium"
      >
        Competencias
      </Link>

      <Link
        href="/molestias"
        className={`block rounded-lg p-3 text-center font-medium ${
          painCount > 0
            ? "bg-amber-200 text-black"
            : "border border-neutral-600"
        }`}
      >
        {painCount > 0
          ? `Molestias (${painCount} ${painCount === 1 ? "activa" : "activas"})`
          : "Molestias"}
      </Link>

      <Link
        href="/perfil"
        className="block rounded-lg border border-neutral-600 p-3 text-center font-medium"
      >
        Mi ficha
      </Link>

      <form action={logout}>
        <button className="rounded-lg border border-neutral-600 px-4 py-2">
          Salir
        </button>
      </form>
    </>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen bg-neutral-950 p-6 text-neutral-100">
      <div className="mx-auto max-w-md space-y-4">
        <Suspense fallback={<p className="text-neutral-400">Cargando…</p>}>
          <UserInfo />
        </Suspense>
      </div>
    </main>
  );
}
