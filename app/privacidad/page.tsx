import type { Metadata } from 'next'
import Link from 'next/link'
import LegalPage, { LegalSection } from '@/components/LegalPage'
import { APP_NAME, CONTACT_EMAIL } from '@/lib/legal'

export const metadata: Metadata = { title: `Privacidad | ${APP_NAME}` }

export default function PrivacidadPage() {
  return (
    <LegalPage title="Política de privacidad">
      <p>
        {APP_NAME} guarda información personal y de salud para que puedas llevar el registro
        de tu entrenamiento. Acá te contamos qué guarda, para qué y cómo podés controlarlo.
      </p>

      <LegalSection title="Qué datos guarda">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong className="text-neutral-100">Tu cuenta:</strong> email y contraseña. La
            contraseña la guarda cifrada el servicio de autenticación; nadie puede verla.
          </li>
          <li>
            <strong className="text-neutral-100">Tu ficha:</strong> nombre, fecha de
            nacimiento, sexo, altura, peso y objetivos.
          </li>
          <li>
            <strong className="text-neutral-100">Tu entrenamiento:</strong> sesiones, tiempos
            de pista, ejercicios, series y kilos, esfuerzo y cómo te sentiste.
          </li>
          <li>
            <strong className="text-neutral-100">Salud y recuperación:</strong> molestias o
            lesiones, horas de sueño, energía y dolor muscular.
          </li>
          <li>
            <strong className="text-neutral-100">Calendario y competencias:</strong> los
            eventos que cargues, incluso los de tu vida diaria, y tus resultados.
          </li>
        </ul>
        <p>
          Parte de estos datos son datos de salud, que la ley considera sensibles. Por eso
          solo se guardan si los cargás vos y si aceptás estas condiciones.
        </p>
      </LegalSection>

      <LegalSection title="Para qué se usan">
        <p>
          Únicamente para mostrarte tu historial, tu calendario y tus gráficos. No se venden,
          no se usan para publicidad y no se comparten con otras personas: cada usuario ve
          solo lo suyo.
        </p>
      </LegalSection>

      <LegalSection title="Quién puede acceder">
        <p>
          Vos, con tu cuenta. Además, quien administra la app tiene acceso técnico a la base
          de datos para mantenerla y dar soporte. Usa ese acceso solo para eso.
        </p>
      </LegalSection>

      <LegalSection title="Dónde se guardan">
        <p>
          En servicios de terceros: Supabase (base de datos y cuentas) y Vercel (alojamiento
          de la app). Sus servidores pueden estar fuera de Argentina.
        </p>
      </LegalSection>

      <LegalSection title="Inteligencia artificial">
        <p>
          Hoy la app no envía tus datos a ningún servicio de inteligencia artificial. Si en el
          futuro se agrega un coach con IA, se actualizará esta política y se te avisará antes
          de que se use.
        </p>
      </LegalSection>

      <LegalSection title="Tus derechos">
        <p>
          Podés ver y corregir tus datos desde la app, descargar una copia y eliminar tu cuenta
          cuando quieras, desde <strong className="text-neutral-100">Más</strong>. Son los
          derechos de acceso, rectificación y supresión de la Ley 25.326 de Protección de los
          Datos Personales. Para cualquier consulta:{' '}
          <a className="font-medium text-brand-fg underline" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="Cuánto tiempo se guardan">
        <p>
          Hasta que elimines tu cuenta. Al eliminarla se borran todos tus datos de forma
          definitiva. Las copias de seguridad que mantengan los proveedores pueden conservarlos
          durante un tiempo limitado más.
        </p>
      </LegalSection>

      <LegalSection title="Edad">
        <p>La app está pensada para personas mayores de 18 años.</p>
      </LegalSection>

      <LegalSection title="Cambios">
        <p>
          Si esta política cambia, se actualiza la fecha de arriba. Mirá también los{' '}
          <Link className="font-medium text-brand-fg underline" href="/terminos">
            Términos de uso
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPage>
  )
}
