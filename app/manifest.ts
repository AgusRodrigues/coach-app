import type { MetadataRoute } from 'next'

// Next.js lo publica en /manifest.webmanifest y lo enlaza solo en el <head>.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Coach',
    short_name: 'Coach',
    description: 'Tu entrenamiento de velocidad, gimnasio y recuperación.',
    lang: 'es-AR',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    // Pantalla de arranque en bordo, con el icono en el centro
    background_color: '#8b2332',
    theme_color: '#8b2332',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
