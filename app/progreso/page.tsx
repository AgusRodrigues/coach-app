import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { loadProgress } from "@/lib/progress";
import { todayISO } from "@/lib/dates";
import ProgressCharts from "./ProgressCharts";

// Todo lo que lee sesion o datos va dentro de Suspense, y empieza con connection()
async function ProgressContent() {
  await connection();

  const supabase = await createClient();
  const data = await loadProgress(supabase);

  return <ProgressCharts data={data} today={todayISO()} />;
}

export default function ProgresoPage() {
  return (
    <main className="min-h-screen bg-neutral-950 p-6 text-neutral-100">
      <div className="mx-auto max-w-md space-y-4">
        <Link href="/" className="text-sm text-neutral-400">
          ← Inicio
        </Link>
        <h1 className="text-2xl font-semibold">Progreso</h1>

        <Suspense
          fallback={<p className="text-neutral-400">Cargando gráficos…</p>}
        >
          <ProgressContent />
        </Suspense>
      </div>
    </main>
  );
}
