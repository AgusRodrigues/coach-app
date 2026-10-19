import type { Metadata } from 'next'
import Link from 'next/link'
import LegalPage, { LegalSection } from '@/components/LegalPage'
import { APP_NAME, CONTACT_EMAIL } from '@/lib/legal'

export const metadata: Metadata = { title: `Términos | ${APP_NAME}` }

export default function TerminosPage() {
  return (
    <LegalPage title="Términos de uso">
      <p>
        Al crear una cuenta en {APP_NAME} aceptás estos términos. Son cortos y están escritos
        en lenguaje simple.
      </p>

      <LegalSection title="Qué es esta app">
        <p>
          Una herramienta para registrar y ordenar tu entrenamiento de velocidad, gimnasio y
          recuperación. Está en fase de prueba.
        </p>
      </LegalSection>

      <LegalSection title="No es consejo médico">
        <p>
          La app no diagnostica ni trata lesiones o enfermedades, y no reemplaza a un médico,
          a un kinesiólogo ni a un entrenador. Ante un dolor agudo, que empeora o que dura más
          de unos días, consultá a un profesional antes de seguir entrenando. Entrenás bajo tu
          propia responsabilidad.
        </p>
      </LegalSection>

      <LegalSection title="Fase de prueba">
        <p>
          Puede tener errores, cambiar o dejar de funcionar sin aviso. Se ofrece tal como está,
          sin garantías de que la información sea correcta ni adecuada para tu caso. Podés
          descargar una copia de tus datos cuando quieras desde{' '}
          <strong className="text-neutral-100">Más</strong>.
        </p>
      </LegalSection>

      <LegalSection title="Tu cuenta">
        <p>
          Sos responsable de tu contraseña y de que los datos que cargues sean tuyos. No uses
          la app para dañarla ni para acceder a datos de otras personas.
        </p>
      </LegalSection>

      <LegalSection title="Eliminar tu cuenta">
        <p>
          Podés eliminarla cuando quieras desde <strong className="text-neutral-100">Más</strong>
          . Quien administra la app puede suspender cuentas que se usen de forma indebida.
        </p>
      </LegalSection>

      <LegalSection title="Contacto y privacidad">
        <p>
          Dudas o pedidos:{' '}
          <a className="font-medium text-brand-fg underline" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
          . Cómo se tratan tus datos está explicado en la{' '}
          <Link className="font-medium text-brand-fg underline" href="/privacidad">
            Política de privacidad
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPage>
  )
}
