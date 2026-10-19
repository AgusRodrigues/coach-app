'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/lib/supabase-admin'

function fail(text: string): never {
  redirect(`/mas/eliminar?error=${encodeURIComponent(text)}`)
}

export async function deleteAccount(formData: FormData) {
  const supabase = await createClient()

  // El usuario sale de la sesion verificada: nunca de un dato enviado por el formulario
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub
  if (!userId) redirect('/login')

  // Confirmacion escrita: evita borrar por un toque accidental
  const confirmation = String(formData.get('confirm') ?? '').trim().toUpperCase()
  if (confirmation !== 'ELIMINAR') {
    fail('Para confirmar, escribí la palabra ELIMINAR.')
  }

  // Todas las tablas de datos apuntan a auth.users con "on delete cascade":
  // borrar el usuario borra tambien su ficha, sesiones, molestias, check-ins, etc.
  // (redirect() funciona lanzando una excepcion, por eso no se llama dentro del try)
  let deleteFailed = false
  try {
    const admin = createAdminClient()
    const { error } = await admin.auth.admin.deleteUser(userId)
    deleteFailed = !!error
  } catch {
    deleteFailed = true
  }

  if (deleteFailed) {
    fail('No se pudo eliminar la cuenta. Probá de nuevo en unos minutos.')
  }

  // Cierra la sesion en este dispositivo (la cuenta ya no existe)
  try {
    await supabase.auth.signOut({ scope: 'local' })
  } catch {
    // Si falla, igual la cuenta ya no existe y la sesion deja de ser valida
  }

  redirect('/login?message=' + encodeURIComponent('Tu cuenta y tus datos fueron eliminados.'))
}
