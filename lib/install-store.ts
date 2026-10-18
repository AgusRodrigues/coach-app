// Guarda el aviso "esta app se puede instalar" que dispara el navegador (Chrome y Edge,
// en Android y escritorio). El evento se dispara una sola vez y temprano, por eso se
// captura desde el layout (siempre montado) y se lee desde cualquier pantalla.
//
// Safari en iPhone no tiene este evento: ahi la instalacion es manual.

export type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: InstallPromptEvent | null = null
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((listener) => listener())
}

// Empieza a escuchar; devuelve la funcion que deja de hacerlo
export function captureInstallPrompt(): () => void {
  const onPrompt = (event: Event) => {
    event.preventDefault() // evita el mini-cartel del navegador: lo mostramos nosotros
    deferred = event as InstallPromptEvent
    emit()
  }
  const onInstalled = () => {
    deferred = null
    emit()
  }

  window.addEventListener('beforeinstallprompt', onPrompt)
  window.addEventListener('appinstalled', onInstalled)

  return () => {
    window.removeEventListener('beforeinstallprompt', onPrompt)
    window.removeEventListener('appinstalled', onInstalled)
  }
}

export function subscribeInstall(callback: () => void): () => void {
  listeners.add(callback)
  return () => {
    listeners.delete(callback)
  }
}

export function getInstallPrompt(): InstallPromptEvent | null {
  return deferred
}

export function clearInstallPrompt() {
  deferred = null
  emit()
}
