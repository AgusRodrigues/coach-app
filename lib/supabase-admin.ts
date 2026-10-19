// Cliente de ADMINISTRADOR de Supabase.
//
// Se salta todas las reglas de seguridad (RLS), por eso:
//  - 'server-only' hace que el build FALLE si alguien lo importa desde codigo del navegador.
//  - La clave NO lleva el prefijo NEXT_PUBLIC_, asi que Next.js nunca la envia al navegador.
//  - Se usa unicamente para eliminar la cuenta de la persona que lo pide.
import 'server-only'
import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY en las variables de entorno')
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
