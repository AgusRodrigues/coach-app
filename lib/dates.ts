// Zona horaria fija: Buenos Aires (UTC-3, Argentina no usa horario de verano).
// Mas adelante se puede guardar la zona horaria en el perfil de cada usuario.
export const TZ = 'America/Argentina/Buenos_Aires'
const OFFSET = '-03:00'

// Fecha de hoy en Buenos Aires, formato YYYY-MM-DD
export function todayISO(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ })
}

export function isValidISO(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false
  const d = new Date(iso + 'T12:00:00Z')
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso
}

export function isValidTime(time: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time)
}

export function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// Lunes de la semana a la que pertenece la fecha
export function mondayOf(iso: string): string {
  const d = new Date(iso + 'T12:00:00Z')
  const dow = (d.getUTCDay() + 6) % 7 // lunes = 0 ... domingo = 6
  return addDays(iso, -dow)
}

// Fecha (YYYY-MM-DD) de un timestamp, vista en Buenos Aires
export function isoDateInTZ(ts: string): string {
  return new Date(ts).toLocaleDateString('en-CA', { timeZone: TZ })
}

// Hora (HH:MM) de un timestamp, vista en Buenos Aires
export function timeInTZ(ts: string): string {
  return new Date(ts).toLocaleTimeString('es-AR', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

// "lunes, 12 oct"
export function dayLabel(iso: string): string {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('es-AR', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  })
}

// "12 oct"
export function shortDate(iso: string): string {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('es-AR', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
  })
}

// Fecha + hora locales de Buenos Aires -> timestamp con zona horaria
export function toTimestamp(date: string, time: string): string {
  return `${date}T${time}:00${OFFSET}`
}