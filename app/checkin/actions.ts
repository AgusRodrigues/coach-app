'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { todayISO } from '@/lib/dates'

function intIn(value: FormDataEntryValue | null, min: number, max: number): number | null {
  const s = String(value ?? '').trim()
  if (!/^\d+$/.test(s)) return null
  const n = parseInt(s, 10)
  return n >= min && n <= max ? n : null
}

export async function saveCheckin(formData: FormData) {
  const supabase = await createClient()

  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub
  if (!userId) redirect('/login')

  function failHere(text: string): never {
    redirect(`/checkin?error=${encodeURIComponent(text)}`)
  }

  const sleepRaw = String(formData.get('sleep_hours') ?? '').trim().replace(',', '.')
  const sleepHours = sleepRaw === '' ? NaN : Number(sleepRaw)
  const quality = intIn(formData.get('sleep_quality'), 1, 5)
  const energy = intIn(formData.get('energy'), 1, 5)
  const soreness = intIn(formData.get('soreness'), 1, 5)
  const notes = String(formData.get('notes') ?? '').trim() || null

  if (!Number.isFinite(sleepHours) || sleepHours < 0 || sleepHours > 24) {
    failHere('Las horas de sueño tienen que estar entre 0 y 24.')
  }
  if (quality === null) failHere('Elegí cómo dormiste.')
  if (energy === null) failHere('Elegí tu nivel de energía.')
  if (soreness === null) failHere('Elegí cuánto dolor muscular tenés.')

  // Un check-in por dia: si ya existe el de hoy, se actualiza
  const { error } = await supabase.from('daily_checkins').upsert(
    {
      user_id: userId,
      checkin_date: todayISO(),
      sleep_hours: Math.round(sleepHours * 10) / 10,
      sleep_quality: quality,
      energy,
      soreness,
      notes,
    },
    { onConflict: 'user_id,checkin_date' }
  )

  if (error) failHere('No se pudo guardar el check-in.')

  revalidatePath('/')
  revalidatePath('/checkin')
  redirect('/')
}
