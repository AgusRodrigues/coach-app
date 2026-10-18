'use client'

import { useSyncExternalStore } from 'react'
import {
  clearInstallPrompt,
  getInstallPrompt,
  subscribeInstall,
} from '@/lib/install-store'

// ---- Datos del dispositivo, leidos de forma segura para el render ----

function subscribeStandalone(callback: () => void) {
  const query = window.matchMedia('(display-mode: standalone)')
  query.addEventListener('change', callback)
  return () => query.removeEventListener('change', callback)
}

function getStandalone(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return window.matchMedia('(display-mode: standalone)').matches || iosStandalone
}

function noopSubscribe() {
  return () => {}
}

function getIsIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

export default function InstallCard() {
  const promptEvent = useSyncExternalStore(subscribeInstall, getInstallPrompt, () => null)
  const standalone = useSyncExternalStore(subscribeStandalone, getStandalone, () => false)
  const ios = useSyncExternalStore(noopSubscribe, getIsIOS, () => false)

  // Ya esta instalada y abierta como app: no hay nada que ofrecer
  if (standalone) return null

  // Android y escritorio (Chrome, Edge): boton propio
  if (promptEvent) {
    return (
      <section className="space-y-3 rounded-2xl border border-brand bg-brand-soft p-4">
        <div>
          <p className="font-semibold">Instalá la app</p>
          <p className="text-sm text-neutral-400">
            Se abre a pantalla completa y queda en tu pantalla de inicio, como cualquier otra.
          </p>
        </div>
        <button
          onClick={async () => {
            await promptEvent.prompt()
            await promptEvent.userChoice
            clearInstallPrompt() // el aviso solo se puede usar una vez
          }}
          className="w-full rounded-xl bg-brand p-3 font-semibold text-on-brand"
        >
          Instalar
        </button>
      </section>
    )
  }

  // iPhone y iPad: Safari no permite el boton, la instalacion es manual
  if (ios) {
    return (
      <section className="space-y-2 rounded-2xl border border-brand bg-brand-soft p-4">
        <p className="font-semibold">Instalá la app en tu iPhone</p>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-neutral-300">
          <li>Abrí esta página en Safari.</li>
          <li>Tocá el botón Compartir, el cuadrado con la flecha hacia arriba.</li>
          <li>Elegí «Agregar a inicio».</li>
        </ol>
      </section>
    )
  }

  return null
}
