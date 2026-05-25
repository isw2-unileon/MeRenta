import { Link } from "react-router-dom";
import * as React from "react";

// 1. Componente para la cabecera
const PrivacyHeader = () => (
  <header className="mb-12">
    <p className="text-card-loc text-subtle tracking-eyebrow mb-3 uppercase">Legal</p>
    <h1 className="text-2xl font-semibold">Política de Privacidad</h1>
    <p className="text-body-color mt-4 max-w-3xl">
      En MeRenta nos tomamos en serio tu privacidad. Esta Política de Privacidad explica qué datos recopilamos, cómo los
      usamos, con quién los compartimos y qué derechos tienes como usuario de la plataforma.
    </p>
    <div className="text-card-sm text-subtle mt-4 flex flex-wrap gap-x-6 gap-y-2">
      <span>Última actualización: 25 de mayo de 2026</span>
      <span>Vigente desde: 1 de junio de 2026</span>
      <span>Versión: 1.0</span>
    </div>
  </header>
);

// 2. Componente para las tarjetas de resumen
const PrivacySummary = () => (
  <section className="mb-10 grid gap-4 md:grid-cols-3">
    <div className="border-border-main bg-surface rounded-lg border p-5">
      <h2 className="text-body-lg text-ink font-semibold">Transparencia</h2>
      <p className="text-body-color mt-2">
        Solo recopilamos datos necesarios para operar el marketplace, mejorar la experiencia y cumplir obligaciones
        legales.
      </p>
    </div>
    <div className="border-border-main bg-surface rounded-lg border p-5">
      <h2 className="text-body-lg text-ink font-semibold">Control</h2>
      <p className="text-body-color mt-2">
        Puedes acceder, corregir o eliminar tus datos y gestionar permisos desde tu cuenta o contactándonos.
      </p>
    </div>
    <div className="border-border-main bg-surface rounded-lg border p-5">
      <h2 className="text-body-lg text-ink font-semibold">Seguridad</h2>
      <p className="text-body-color mt-2">
        Aplicamos medidas técnicas y organizativas para proteger tu información frente a accesos no autorizados.
      </p>
    </div>
  </section>
);

// 3. Componente para la tabla de contenidos
const PrivacyTOC = () => {
  const links = [
    { href: "#responsable", text: "1. Responsable del tratamiento" },
    { href: "#datos", text: "2. Datos que recopilamos" },
    { href: "#finalidades", text: "3. Finalidades y base legal" },
    { href: "#compartir", text: "4. Con quién compartimos datos" },
    { href: "#retencion", text: "5. Conservación de datos" },
    { href: "#seguridad", text: "6. Seguridad de la información" },
    { href: "#derechos", text: "7. Tus derechos" },
    { href: "#cookies", text: "8. Cookies y tecnologías similares" },
    { href: "#menores", text: "9. Menores de edad" },
    { href: "#transferencias", text: "10. Transferencias internacionales" },
    { href: "#cambios", text: "11. Cambios en la política" },
    { href: "#contacto", text: "12. Contacto" },
  ];

  return (
    <nav
      className="border-border-main rounded-panel border bg-white p-6"
      aria-label="Tabla de contenidos"
    >
      <h2 className="text-body-lg text-ink font-semibold">Contenido</h2>
      <ul className="text-body-color mt-4 grid gap-2 md:grid-cols-2">
        {links.map((link) => (
          <li key={link.href}>
            <a
              className="link-section"
              href={link.href}
            >
              {link.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
};

// 4. Componente auxiliar para unificar el estilo de las secciones
const Section = ({ id, title, children }: { id: string; title: string; children: React.ReactNode }) => (
  <section
    id={id}
    className="space-y-3"
  >
    <h2 className="text-body-lg text-ink font-semibold">{title}</h2>
    {children}
  </section>
);

// 5. Componente para el contenido principal (los textos)
const PrivacyContent = () => (
  <div className="mt-12 space-y-10">
    <Section
      id="responsable"
      title="1. Responsable del tratamiento"
    >
      <p className="text-body-color">
        MeRenta es el responsable del tratamiento de los datos personales recogidos a través de la plataforma. Puedes
        escribirnos a
        <a
          className="link-section ml-1"
          href="mailto:contact@merenta.com"
        >
          contact@merenta.com
        </a>
        para cualquier consulta relacionada con privacidad.
      </p>
    </Section>

    <Section
      id="datos"
      title="2. Datos que recopilamos"
    >
      <ul className="text-body-color list-disc space-y-2 pl-5">
        <li>
          <strong>Datos de cuenta:</strong> nombre, correo electrónico, contraseña cifrada, número de teléfono y foto de
          perfil.
        </li>
        <li>
          <strong>Datos de uso:</strong> historial de reservas, anuncios, favoritos, mensajes y reseñas.
        </li>
        <li>
          <strong>Datos de pago:</strong> información limitada necesaria para procesar pagos (gestionada por proveedores
          externos).
        </li>
        <li>
          <strong>Datos técnicos:</strong> dirección IP, tipo de navegador, dispositivo, registros de acceso y cookies.
        </li>
      </ul>
    </Section>

    <Section
      id="finalidades"
      title="3. Finalidades y base legal"
    >
      <p className="text-body-color">
        Tratamos tus datos para proporcionar el servicio, mejorar la plataforma y cumplir obligaciones legales. Las
        bases legales incluyen la ejecución del contrato, el consentimiento y el interés legítimo.
      </p>
      <ul className="text-body-color list-disc space-y-2 pl-5">
        <li>Gestionar cuentas, reservas, pagos y comunicaciones entre usuarios.</li>
        <li>Prevenir fraude y garantizar la seguridad de la comunidad.</li>
        <li>Enviar notificaciones operativas y actualizaciones del servicio.</li>
        <li>Analizar métricas para mejorar la experiencia de uso.</li>
      </ul>
    </Section>

    <Section
      id="compartir"
      title="4. Con quién compartimos datos"
    >
      <p className="text-body-color">
        Solo compartimos datos cuando es necesario para operar el servicio o cumplir la ley:
      </p>
      <ul className="text-body-color list-disc space-y-2 pl-5">
        <li>Proveedores de pago, verificación y almacenamiento (p. ej., Stripe o servicios en la nube).</li>
        <li>Autoridades legales cuando exista obligación o requerimiento válido.</li>
        <li>Otros usuarios, únicamente la información necesaria para gestionar una reserva.</li>
      </ul>
    </Section>

    <Section
      id="retencion"
      title="5. Conservación de datos"
    >
      <p className="text-body-color">
        Conservamos los datos mientras exista una relación activa o sea necesario para cumplir obligaciones legales.
        Puedes solicitar la eliminación de tu cuenta; algunos datos se mantendrán por plazos legales o para la defensa
        ante reclamaciones.
      </p>
    </Section>

    <Section
      id="seguridad"
      title="6. Seguridad de la información"
    >
      <p className="text-body-color">
        Implementamos medidas como cifrado de contraseñas, controles de acceso, monitoreo y copias de seguridad. Aun
        así, ningún sistema es completamente infalible.
      </p>
    </Section>

    <Section
      id="derechos"
      title="7. Tus derechos"
    >
      <p className="text-body-color">Puedes ejercer los siguientes derechos:</p>
      <ul className="text-body-color list-disc space-y-2 pl-5">
        <li>Acceso, rectificación y eliminación de datos.</li>
        <li>Oposición o limitación del tratamiento.</li>
        <li>Portabilidad de datos cuando aplique.</li>
        <li>Retirar tu consentimiento en cualquier momento.</li>
      </ul>
      <p className="text-body-color">
        Para ejercerlos, contáctanos en
        <a
          className="link-section ml-1"
          href="mailto:contact@merenta.com"
        >
          contact@merenta.com
        </a>
        .
      </p>
    </Section>

    <Section
      id="cookies"
      title="8. Cookies y tecnologías similares"
    >
      <p className="text-body-color">
        Usamos cookies esenciales para el funcionamiento de la plataforma y cookies de análisis para entender el uso.
        Puedes gestionar las cookies desde tu navegador.
      </p>
    </Section>

    <Section
      id="menores"
      title="9. Menores de edad"
    >
      <p className="text-body-color">
        La plataforma está destinada a mayores de 18 años. Si detectamos que un menor ha creado una cuenta, procederemos
        a su eliminación.
      </p>
    </Section>

    <Section
      id="transferencias"
      title="10. Transferencias internacionales"
    >
      <p className="text-body-color">
        Algunos proveedores pueden estar ubicados fuera de tu país. En esos casos, aplicamos garantías adecuadas para
        proteger tu información.
      </p>
    </Section>

    <Section
      id="cambios"
      title="11. Cambios en la política"
    >
      <p className="text-body-color">
        Podemos actualizar esta política para reflejar cambios legales o funcionales. Te avisaremos de cambios
        relevantes y publicaremos la fecha de vigencia.
      </p>
    </Section>

    <Section
      id="contacto"
      title="12. Contacto"
    >
      <p className="text-body-color">
        Si tienes dudas sobre privacidad, escríbenos a
        <a
          className="link-section ml-1"
          href="mailto:contact@merenta.com"
        >
          contact@merenta.com
        </a>
        . Consulta también los
        <Link
          className="link-section ml-1"
          to="/terms"
        >
          Términos y Condiciones
        </Link>
        .
      </p>
    </Section>
  </div>
);

/**
 * Privacy policy page.
 * @returns The privacy policy content.
 */
function Privacy() {
  return (
    <div className="bg-page">
      <div className="max-w-alert-width px-layout-margin mx-auto py-16">
        <PrivacyHeader />
        <PrivacySummary />
        <PrivacyTOC />
        <PrivacyContent />
      </div>
    </div>
  );
}

export { Privacy };
