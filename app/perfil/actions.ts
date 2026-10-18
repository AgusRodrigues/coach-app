'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

// Convierte "1,85" o "1.85" en numero; vacio -> null
function num(value: FormDataEntryValue | null): number | null {
  const s = String(value ?? '').trim().replace(',', '.')
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function txt(value: FormDataEntryValue | null): string | null {
  const s = String(value ?? '').trim()
  return s || null
}

function back(kind: 'error' | 'message', text: string): never {
  redirect(`/perfil?${kind}=${encodeURIComponent(text)}`)
}

export async function saveProfile(formData: FormData) {
  const supabase = await createClient()

  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub
  if (!userId) redirect('/login')

  // Si ya dio su consentimiento antes, no lo pisamos
  const { data: current } = await supabase
    .from('profiles')
    .select('consent_at')
    .eq('id', userId)
    .maybeSingle()

  const wantsConsent = formData.get('consent') === 'on'
  const consent_at =
    current?.consent_at ?? (wantsConsent ? new Date().toISOString() : null)

  const { error } = await supabase
    .from('profiles')
    .update({
      display_name: txt(formData.get('display_name')),
      birth_date: txt(formData.get('birth_date')),
      sex: txt(formData.get('sex')),
      height_cm: num(formData.get('height_cm')),
      weekly_hours: num(formData.get('weekly_hours')),
      goal_3m: txt(formData.get('goal_3m')),
      goal_12m: txt(formData.get('goal_12m')),
      consent_at,
    })
    .eq('id', userId)

  if (error) {
    back('error', 'No se pudo guardar. Revisá que los valores sean válidos.')
  }

  // Peso: solo se registra una medicion nueva si cambio respecto de la ultima
  const weight = num(formData.get('weight_kg'))
  const lastWeight = num(formData.get('last_weight'))

  if (weight !== null && weight !== lastWeight) {
    const { error: weightError } = await supabase
      .from('body_measurements')
      .insert({ weight_kg: weight })

    if (weightError) {
      back('error', 'Se guardó la ficha, pero el peso no es válido (20 a 300 kg).')
    }
  }

  revalidatePath('/perfil')
  back('message', 'Ficha guardada.')
}
