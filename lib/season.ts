// Fase orientativa segun cuanto falta para la competencia principal.
// Es una referencia general de periodizacion, no un plan.
export function phaseFor(days: number): { name: string; hint: string } {
  if (days <= 7) {
    return {
      name: 'Semana de competencia',
      hint: 'Menos volumen, intensidad justa y prioridad al descanso, al sueño y a la comida.',
    }
  }
  if (days <= 28) {
    return {
      name: 'Pre-competitiva',
      hint: 'Sesiones de calidad cerca de tu ritmo de carrera, con recuperación completa entre ellas.',
    }
  }
  if (days <= 84) {
    return {
      name: 'Preparación específica',
      hint: 'Más trabajo de velocidad y de tolerancia al esfuerzo propio de tu prueba.',
    }
  }
  return {
    name: 'Preparación general',
    hint: 'Construir base: fuerza, técnica y volumen de trabajo.',
  }
}

export function countdown(days: number): string {
  if (days === 0) return 'hoy'
  if (days === 1) return 'mañana'
  if (days < 14) return `en ${days} días`
  return `en ${Math.round(days / 7)} semanas (${days} días)`
}
