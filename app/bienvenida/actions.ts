'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { timed } from '@/lib/timing'

// Marca el tutorial como visto (al terminarlo o al saltarlo) y sigue a donde se pidio.
export async function completeOnboarding(formData: FormData) {
  const supabase = await createClient()

  // No hace falta verificar la sesion otra vez: el proxy ya lo hizo en esta misma peticion,
  // y la regla de seguridad de la base (RLS) solo deja modificar el perfil propio. Si por algun
  // motivo no hubiera sesion, la actualizacion no afecta a ninguna fila.
  // Solo se guarda la primera vez: al repasar el tutorial no se pisa la fecha original.
  await timed(
    'bienvenida: update del perfil',
    supabase
      .from('profiles')
      .update({ onboarded_at: new Date().toISOString() })
      .is('onboarded_at', null)
  )

  // Solo hay dos destinos posibles: nunca se redirige a una direccion que venga del formulario
  redirect(formData.get('next') === 'perfil' ? '/perfil' : '/')
}
