// Service worker de Coach.
//
// Hace una sola cosa: si abris la app sin internet, muestra la pantalla /offline
// en vez del error del navegador.
//
// A proposito NO guarda paginas de la app en el telefono: tienen datos de salud y
// de entrenamiento, y las respuestas dependen de quien este logueado.

const CACHE = 'coach-offline-v1'
const OFFLINE_URL = '/offline'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL, '/icons/icon-192.png']))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request

  // Solo se intervienen las navegaciones (abrir o recargar una pagina).
  // Todo lo demas (datos, scripts, imagenes) pasa directo a la red.
  if (request.mode !== 'navigate') return

  event.respondWith(
    fetch(request).catch(async () => {
      const cache = await caches.open(CACHE)
      return (
        (await cache.match(OFFLINE_URL)) ||
        new Response('Sin conexión', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        })
      )
    })
  )
})
