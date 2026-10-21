'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
  })

  if (error) {
    redirect('/login?error=' + encodeURIComponent('Email o contraseña incorrectos'))
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function signup(formData: FormData) {
  // Crear una cuenta exige aceptar los terminos y la politica de privacidad.
  // (Ingresar con una cuenta existente no lo pide.)
  if (formData.get('accept') !== 'on') {
    redirect(
      '/login?error=' +
        encodeURIComponent('Para crear la cuenta tenés que aceptar los Términos y la Política de privacidad.')
    )
  }

  const supabase = await createClient()

  const { data, error } = await supabase.auth.signUp({
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
    // Queda registrado cuando se acepto
    options: { data: { accepted_terms_at: new Date().toISOString() } },
  })

  if (error) {
    redirect('/login?error=' + encodeURIComponent(error.message))
  }

  // Si la confirmacion por email esta activada, todavia no hay sesion
  if (!data.session) {
    redirect(
      '/login?message=' +
        encodeURIComponent('Cuenta creada. Revisá tu email para confirmarla.')
    )
  }

  revalidatePath('/', 'layout')
  redirect('/bienvenida')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
