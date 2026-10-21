import type { Metadata } from 'next'
import Onboarding from '@/components/Onboarding'

export const metadata: Metadata = { title: 'Bienvenida | Coach' }

// No lee datos: el tutorial es el mismo para todos. La sesion la exige el proxy, y la accion
// que marca el tutorial como visto la verifica de nuevo.
export default function BienvenidaPage() {
  return (
    <main>
      <h1 className="sr-only">Tutorial de bienvenida</h1>
      <Onboarding />
    </main>
  )
}
