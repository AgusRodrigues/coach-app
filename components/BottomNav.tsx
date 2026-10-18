'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type IconProps = { className?: string }

function HomeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 10v10h13V10" />
    </svg>
  )
}

function CalendarIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </svg>
  )
}

function ChartIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 20h18" />
      <path d="M5.5 15.5 10 10.5l3.5 3L19 6.5" />
    </svg>
  )
}

function MoreIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <circle cx="5.5" cy="12" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="18.5" cy="12" r="1.7" />
    </svg>
  )
}

const MORE_PATHS = ['/mas', '/perfil', '/molestias', '/competencias', '/checkin']

const TABS = [
  { href: '/', label: 'Inicio', Icon: HomeIcon, active: (p: string) => p === '/' },
  {
    href: '/calendario',
    label: 'Calendario',
    Icon: CalendarIcon,
    active: (p: string) => p.startsWith('/calendario'),
  },
  {
    href: '/progreso',
    label: 'Progreso',
    Icon: ChartIcon,
    active: (p: string) => p.startsWith('/progreso'),
  },
  {
    href: '/mas',
    label: 'Más',
    Icon: MoreIcon,
    active: (p: string) => MORE_PATHS.some((m) => p.startsWith(m)),
  },
]

export default function BottomNav() {
  const pathname = usePathname()

  // Sin barra en el login ni en el formulario de sesion (para no salir sin querer)
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/sesion') ||
    pathname.startsWith('/offline')
  ) {
    return null
  }

  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-neutral-700 bg-neutral-900/90 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-md">
        {TABS.map(({ href, label, Icon, active }) => {
          const isActive = active(pathname)
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={isActive ? 'page' : undefined}
                className={`relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
                  isActive ? 'text-brand-fg' : 'text-neutral-400'
                }`}
              >
                {isActive && (
                  <span className="tab-indicator absolute inset-x-7 top-0 h-0.5 rounded-full bg-brand" />
                )}
                <Icon className="h-6 w-6" />
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
