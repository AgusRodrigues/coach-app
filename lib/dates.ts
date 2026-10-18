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

// Dias entre dos fechas ISO (to - from). Ej: daysBetween('2026-10-10', '2026-10-17') = 7
export function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000
  )
}

// ---- Meses (formato "YYYY-MM") ----

export function isValidMonth(ym: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(ym)
}

// addMonths('2026-10', 1) = '2026-11' ; addMonths('2026-01', -1) = '2025-12'
export function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7)
}

// "octubre de 2026"
export function monthLabel(ym: string): string {
  return new Date(`${ym}-01T12:00:00Z`).toLocaleDateString('es-AR', {
    timeZone: 'UTC',
    month: 'long',
    year: 'numeric',
  })
}

// Todos los dias de la grilla del mes: desde el lunes de la semana del dia 1
// hasta el domingo de la semana del ultimo dia (35 o 42 dias).
export function monthGrid(ym: string): string[] {
  const first = `${ym}-01`
  const last = addDays(`${addMonths(ym, 1)}-01`, -1)
  const start = mondayOf(first)
  const end = addDays(mondayOf(last), 6)

  const out: string[] = []
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d)
  return out
}

// Fecha + hora locales de Buenos Aires -> timestamp con zona horaria
export function toTimestamp(date: string, time: string): string {
  return `${date}T${time}:00${OFFSET}`
}
