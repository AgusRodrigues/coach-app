// Los tiempos se guardan como enteros en centesimas de segundo (10,85 s = 1085).

// Acepta "10.85", "10,85", "10.8", "22" o "1:02.30". Devuelve centesimas o null.
export function parseTimeToCs(input: string): number | null {
  const s = input.trim().replace(',', '.')
  const m = /^(?:(\d{1,2}):)?(\d{1,3})(?:\.(\d{1,3}))?$/.exec(s)
  if (!m) return null

  const minutes = m[1] ? parseInt(m[1], 10) : 0
  const seconds = parseInt(m[2], 10)
  if (m[1] && seconds >= 60) return null

  // Fraccion: se toman las dos primeras cifras ("10.8" -> 80 centesimas)
  const cs = m[3] ? parseInt((m[3] + '00').slice(0, 2), 10) : 0

  const total = (minutes * 60 + seconds) * 100 + cs
  return total > 0 && total <= 120000 ? total : null // maximo 20 minutos
}

// 1085 -> "10.85" ; 6230 -> "1:02.30"
export function formatCs(cs: number): string {
  const minutes = Math.floor(cs / 6000)
  const rest = cs % 6000
  const seconds = Math.floor(rest / 100)
  const hundredths = String(rest % 100).padStart(2, '0')

  return minutes > 0
    ? `${minutes}:${String(seconds).padStart(2, '0')}.${hundredths}`
    : `${seconds}.${hundredths}`
}
