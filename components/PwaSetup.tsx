'use client'

import { useEffect } from 'react'
import { captureInstallPrompt } from '@/lib/install-store'

// Va en el layout raiz: no dibuja nada, solo prepara la parte "app instalable".
export default function PwaSetup() {
  useEffect(() => {
    // Captura el aviso de instalacion lo antes posible
    const stopCapturing = captureInstallPrompt()

    // El service worker solo se registra en produccion: en desarrollo cachea cosas
    // y produce confusiones al cambiar el codigo.
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/', updateViaCache: 'none' })
        .catch(() => {
          // Si falla, la app sigue funcionando igual; solo no tendra pantalla sin conexion
        })
    }

    return stopCapturing
  }, [])

  return null
}
