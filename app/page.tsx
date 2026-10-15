import { createClient } from "@/utils/supabase/server";
import { logout } from "./login/actions";

export default async function Home() {
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const email = claimsData?.claims?.email;

  // Prueba de seguridad: gracias a RLS, esto solo devuelve TU perfil
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .maybeSingle();

  return (
    <main className="min-h-screen bg-neutral-950 p-6 text-neutral-100">
      <div className="mx-auto max-w-md space-y-4">
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

        <form action={logout}>
          <button className="rounded-lg border border-neutral-600 px-4 py-2">
            Salir
          </button>
        </form>
      </div>
    </main>
  );
}
