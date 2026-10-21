'use client'

import { useRef, useState, type ReactNode } from 'react'
import { completeOnboarding } from '@/app/bienvenida/actions'

// =====================================================================
// Miniaturas: versiones reducidas de las pantallas reales de la app, para que
// lo que se explica sea lo que despues se ve. Son solo decoracion (aria-hidden).
// Si cambia una pantalla de la app, se actualiza aca la miniatura y el texto.
// =====================================================================

function MiniCard({ children }: { children: ReactNode }) {
  return (
    <div
      aria-hidden
      className="rounded-2xl bg-neutral-900 p-4 text-neutral-100 shadow-lg shadow-black/25"
    >
      {children}
    </div>
  )
}

function ArtWelcome() {
  return (
    <svg
      viewBox="0 0 120 80"
      className="mx-auto h-32 w-auto"
      fill="none"
      aria-hidden
    >
      <path d="M22 10h14l24 30-24 30H22l24-30z" fill="white" fillOpacity="0.45" />
      <path d="M52 10h14l24 30-24 30H52l24-30z" fill="white" />
    </svg>
  )
}

const CAL_DOTS: Record<number, string[]> = {
  2: ['bg-brand-fg'],
  4: ['bg-neutral-100'],
  6: ['bg-brand-fg'],
  9: ['bg-brand-fg', 'bg-neutral-100'],
  11: ['bg-brand-fg'],
  13: ['bg-gold'],
  16: ['bg-brand-fg'],
  18: ['bg-neutral-100'],
}

function ArtCalendar() {
  return (
    <MiniCard>
      <div className="mb-3 grid grid-cols-2 rounded-xl bg-neutral-800 p-0.5 text-[11px] font-semibold">
        <span className="rounded-lg py-1.5 text-center text-neutral-400">Semana</span>
        <span className="rounded-lg bg-brand py-1.5 text-center text-on-brand">Mes</span>
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center text-[11px]">
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
          <span key={i} className="text-neutral-500">
            {d}
          </span>
        ))}
        {Array.from({ length: 21 }, (_, i) => i + 1).map((n) => (
          <span
            key={n}
            className={`flex flex-col items-center gap-0.5 rounded-lg py-1 ${
              n === 11 ? 'ring-1 ring-brand' : ''
            }`}
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full ${
                n === 9 ? 'bg-brand font-semibold text-on-brand' : ''
              }`}
            >
              {n}
            </span>
            <span className="flex h-1 gap-0.5">
              {(CAL_DOTS[n] ?? []).map((c, i) => (
                <span key={i} className={`h-1 w-1 rounded-full ${c}`} />
              ))}
            </span>
          </span>
        ))}
      </div>
    </MiniCard>
  )
}

function ArtSession() {
  return (
    <MiniCard>
      <p className="text-[11px] text-neutral-400">Terminé</p>
      <p className="mb-3 font-semibold">Series 6×60 m</p>

      <p className="mb-1 text-[11px] text-neutral-400">Esfuerzo</p>
      <div className="mb-3 grid grid-cols-10 gap-1">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <span
            key={n}
            className={`flex h-7 items-center justify-center rounded-md text-[11px] ${
              n === 7 ? 'bg-brand font-semibold text-on-brand' : 'bg-neutral-800'
            }`}
          >
            {n}
          </span>
        ))}
      </div>

      <p className="mb-1 text-[11px] text-neutral-400">Cómo te sentiste</p>
      <div className="mb-3 grid grid-cols-5 gap-1">
        {['😫', '😕', '😐', '🙂', '💪'].map((e, i) => (
          <span
            key={i}
            className={`flex h-8 items-center justify-center rounded-md text-base ${
              i === 3 ? 'bg-brand' : 'bg-neutral-800'
            }`}
          >
            {e}
          </span>
        ))}
      </div>

      <span className="block rounded-xl bg-brand py-2 text-center text-xs font-semibold text-on-brand">
        Guardar sesión
      </span>
    </MiniCard>
  )
}

function ScaleRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-neutral-300">{label}</span>
      <span className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <span
            key={n}
            className={`flex h-6 w-6 items-center justify-center rounded-md text-[11px] ${
              n === value
                ? 'bg-brand font-semibold text-on-brand'
                : 'bg-neutral-800 text-neutral-400'
            }`}
          >
            {n}
          </span>
        ))}
      </span>
    </div>
  )
}

function ArtRecovery() {
  return (
    <div className="space-y-2" aria-hidden>
      <MiniCard>
        <p className="mb-2 text-sm font-semibold">Check-in de la mañana</p>
        <div className="space-y-2">
          <ScaleRow label="Sueño" value={4} />
          <ScaleRow label="Energía" value={4} />
          <ScaleRow label="Dolor muscular" value={2} />
        </div>
      </MiniCard>
      <div className="rounded-2xl bg-amber-950 p-3 text-xs ring-1 ring-amber-700">
        <p className="font-semibold text-amber-300">1 molestia activa</p>
        <p className="text-neutral-300">Isquiotibial derecho, tirón, 4/10</p>
      </div>
    </div>
  )
}

const CHART_POINTS: [number, number][] = [
  [8, 20],
  [40, 26],
  [72, 22],
  [104, 34],
  [136, 38],
  [168, 46],
  [192, 52],
]

function ArtProgress() {
  return (
    <MiniCard>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-xs text-neutral-400">100 m, mejor del día</span>
        <span className="font-display text-2xl font-semibold text-brand-fg">10.85</span>
      </div>
      <svg viewBox="0 0 200 70" className="h-20 w-full" fill="none" aria-hidden>
        <path d="M0 55H200M0 30H200" stroke="var(--border)" strokeWidth="1" />
        <polyline
          points={CHART_POINTS.map(([x, y]) => `${x},${y}`).join(' ')}
          stroke="var(--brand-fg)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {CHART_POINTS.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="3" fill="var(--brand-fg)" />
        ))}
      </svg>
      <div className="mt-2 flex gap-1.5 text-[11px]">
        {['3 meses', '6 meses', '1 año', 'Todo'].map((t, i) => (
          <span
            key={t}
            className={`rounded-full px-2.5 py-1 ${
              i === 1 ? 'bg-brand text-on-brand' : 'bg-neutral-800 text-neutral-400'
            }`}
          >
            {t}
          </span>
        ))}
      </div>
    </MiniCard>
  )
}

function ArtCompetition() {
  return (
    <MiniCard>
      <p className="text-xs text-neutral-400">Tu objetivo principal</p>
      <div className="flex items-end gap-2">
        <span className="font-display text-7xl font-bold leading-[0.85] text-brand-fg">23</span>
        <span className="pb-1 text-lg">días</span>
      </div>
      <p className="mt-3 font-semibold">Torneo Metropolitano</p>
      <p className="text-xs text-neutral-400">100 m</p>
      <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
        <span className="rounded-full bg-neutral-800 px-2.5 py-1">Preparación específica</span>
        <span className="rounded-full bg-neutral-800 px-2.5 py-1">Objetivo 10.85 s</span>
      </div>
    </MiniCard>
  )
}

function ArtStart() {
  const steps = ['Completá tu ficha', 'Cargá tu semana en el calendario', 'Hacé tu primer check-in']
  return (
    <MiniCard>
      <p className="mb-3 font-semibold">Para arrancar</p>
      <ul className="space-y-2.5 text-sm">
        {steps.map((s, i) => (
          <li key={s} className="flex items-center gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-brand text-xs font-semibold text-brand-fg">
              {i + 1}
            </span>
            {s}
          </li>
        ))}
      </ul>
    </MiniCard>
  )
}

// =====================================================================
// Pantallas del tutorial
// =====================================================================

type Slide = {
  id: string
  title: string
  body: string
  bullets?: string[]
  art: ReactNode
}

const SLIDES: Slide[] = [
  {
    id: 'bienvenida',
    title: 'Tu entrenamiento, ordenado',
    body: 'Planificá la semana, registrá cada sesión y mirá cómo mejorás. Velocidad, gimnasio y recuperación en un solo lugar.',
    art: <ArtWelcome />,
  },
  {
    id: 'calendario',
    title: 'Armá tu semana en el calendario',
    body: 'Cargá tus entrenamientos y también lo que te ocupa el día. Si se repiten, elegí los días y se cargan en todas las semanas siguientes.',
    bullets: [
      'Mirá la semana o el mes completo',
      'Editá un evento, o toda una serie de una vez',
    ],
    art: <ArtCalendar />,
  },
  {
    id: 'sesion',
    title: 'Al terminar, registrá la sesión',
    body: 'Tocá «Terminé» en un entrenamiento. Lleva unos segundos.',
    bullets: [
      'Pista: el tiempo, el descanso y el viento de cada repetición',
      'Gimnasio: elegís el día de rutina y aparece lo último que hiciste',
      'Siempre: cuánto te costó y cómo te sentiste',
    ],
    art: <ArtSession />,
  },
  {
    id: 'recuperacion',
    title: 'Cuidá tu recuperación',
    body: 'El check-in de la mañana junta tu sueño, tu energía y tu dolor muscular. Si algo te molesta, anotalo: la app te avisa cuándo conviene consultar a un profesional.',
    bullets: ['Molestias activas, historial y zonas que se repiten'],
    art: <ArtRecovery />,
  },
  {
    id: 'progreso',
    title: 'Mirá tu progreso',
    body: 'Tus marcas por distancia, la carga de cada semana, la fuerza por ejercicio, el sueño y el peso. Los gráficos se arman solos con lo que registrás.',
    bullets: ['Elegí el período: 3 meses, 6 meses, 1 año o todo'],
    art: <ArtProgress />,
  },
  {
    id: 'competencias',
    title: 'Apuntá a tu competencia',
    body: 'Cargá tus competencias con el tiempo objetivo. Ves cuántos días faltan, en qué fase de la temporada estás y cuáles son tus mejores marcas.',
    bullets: ['Un viento a favor mayor a 2,0 m/s se marca como no homologable'],
    art: <ArtCompetition />,
  },
  {
    id: 'listo',
    title: 'Listo para empezar',
    body: 'Podés instalar la app en tu pantalla de inicio desde la pestaña Más, y descargar o borrar tus datos cuando quieras. Es una herramienta de apoyo: no reemplaza a un médico ni a un entrenador.',
    art: <ArtStart />,
  },
]

export default function Onboarding() {
  const [index, setIndex] = useState(0)
  const startX = useRef<number | null>(null)

  const last = SLIDES.length - 1
  const isLast = index === last

  function go(i: number) {
    setIndex(Math.min(Math.max(i, 0), last))
  }

  // Deslizar con el dedo: a la izquierda avanza, a la derecha vuelve
  function onTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (startX.current === null) return
    const dx = e.changedTouches[0].clientX - startX.current
    startX.current = null
    if (dx < -50) go(index + 1)
    else if (dx > 50) go(index - 1)
  }

  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-clip bg-neutral-950 text-neutral-100">
      {/* Barra superior sobre el panel bordo */}
      <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-5 pt-[calc(1rem+env(safe-area-inset-top))] text-on-brand">
        <span className="text-sm opacity-90">
          {index + 1} de {SLIDES.length}
        </span>
        {!isLast && (
          <form action={completeOnboarding}>
            <button
              name="next"
              value="home"
              className="rounded-full bg-black/25 px-4 py-2 text-sm font-medium"
            >
              Saltar
            </button>
          </form>
        )}
      </header>

      {/* Pantallas: una al lado de la otra, se desplazan horizontalmente */}
      <div
        className="min-h-0 flex-1 touch-pan-y overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div
          className="flex h-full transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {SLIDES.map((s, i) => (
            <section
              key={s.id}
              inert={i !== index}
              aria-label={`Pantalla ${i + 1} de ${SLIDES.length}`}
              className="flex h-full w-full shrink-0 flex-col"
            >
              <div className="relative flex h-[44dvh] min-h-64 shrink-0 items-center justify-center overflow-hidden bg-brand px-6 pb-4 pt-14 text-on-brand">
                <div aria-hidden className="lane-stripes pointer-events-none absolute inset-0" />
                <div className="relative w-full max-w-xs">{s.art}</div>
              </div>

              <div className="mx-auto min-h-0 w-full max-w-md flex-1 space-y-3 overflow-y-auto px-6 pt-6">
                <h2 className="font-display text-4xl font-bold leading-none">{s.title}</h2>
                <p className="leading-relaxed text-neutral-300">{s.body}</p>
                {s.bullets && (
                  <ul className="space-y-2 text-sm text-neutral-300">
                    {s.bullets.map((b) => (
                      <li key={b} className="flex gap-3">
                        <span
                          aria-hidden
                          className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-fg"
                        />
                        {b}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          ))}
        </div>
      </div>

      {/* Anuncia el cambio de pantalla a los lectores de pantalla */}
      <p className="sr-only" aria-live="polite">
        Pantalla {index + 1} de {SLIDES.length}: {SLIDES[index].title}
      </p>

      {/* Controles */}
      <footer className="mx-auto w-full max-w-md space-y-3 px-6 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3">
        <div className="flex justify-center" role="group" aria-label="Pantallas del tutorial">
          {SLIDES.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => go(i)}
              aria-label={`Ir a la pantalla ${i + 1}`}
              aria-current={i === index ? 'step' : undefined}
              className="flex h-6 items-center px-1"
            >
              <span
                className={`h-2 rounded-full transition-all duration-200 ${
                  i === index ? 'w-6 bg-brand' : 'w-2 bg-neutral-600'
                }`}
              />
            </button>
          ))}
        </div>

        {isLast ? (
          <form action={completeOnboarding} className="grid gap-2">
            <button
              name="next"
              value="perfil"
              className="w-full rounded-xl bg-brand p-3.5 text-lg font-semibold text-on-brand"
            >
              Completar mi ficha
            </button>
            <button
              name="next"
              value="home"
              className="w-full rounded-xl border border-neutral-600 p-3.5 font-medium"
            >
              Ir al inicio
            </button>
          </form>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => go(index - 1)}
              disabled={index === 0}
              className="rounded-xl px-4 py-3 font-medium text-neutral-400 disabled:invisible"
            >
              Atrás
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              className="rounded-xl bg-brand px-8 py-3 text-lg font-semibold text-on-brand"
            >
              Siguiente
            </button>
          </div>
        )}
      </footer>
    </div>
  )
}
