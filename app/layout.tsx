import type { Metadata, Viewport } from 'next'
import { Suspense } from 'react'
import { Barlow_Condensed, Figtree } from 'next/font/google'
import BottomNav from '@/components/BottomNav'
import './globals.css'

// Titulos y numeros grandes: condensada, de cartel de estadio
const display = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display-src',
  display: 'swap',
})

// Texto: sans humanista, clara en pantallas chicas
const body = Figtree({
  subsets: ['latin'],
  variable: '--font-body-src',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Coach',
  description: 'Tu entrenamiento de velocidad, gimnasio y recuperación.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f3f3f4' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${display.variable} ${body.variable}`}>
      <body className="antialiased">
        {children}
        {/* usePathname() necesita Suspense en rutas dinamicas */}
        <Suspense fallback={null}>
          <BottomNav />
        </Suspense>
      </body>
    </html>
  )
}
