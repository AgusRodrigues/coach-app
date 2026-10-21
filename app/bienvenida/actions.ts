'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

// Marca el tutorial como visto (al terminarlo o al saltarlo) y sigue a donde se pidio.
export async function completeOnboarding(formData: FormData) {
  const supabase = await createClient()

  // El usuario sale de la sesion verificada, nunca de un dato del formulario
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub
  if (!userId) redirect('/login')

  // Solo se guarda la primera vez: al repasar el tutorial no se pisa la fecha original
  await supabase
    .from('profiles')
    .update({ onboarded_at: new Date().toISOString() })
    .eq('id', userId)
    .is('onboarded_at', null)

  // Solo hay dos destinos posibles: nunca se redirige a una direccion que venga del formulario
  redirect(formData.get('next') === 'perfil' ? '/perfil' : '/')
}
