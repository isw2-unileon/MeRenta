import { Link } from "react-router-dom";
import * as React from "react";

const TERMS_TOC_LINKS = [
  { href: "#aceptacion", text: "1. Aceptación de los términos" },
  { href: "#definiciones", text: "2. Definiciones" },
  { href: "#cuentas", text: "3. Cuentas y elegibilidad" },
  { href: "#publicaciones", text: "4. Publicaciones y disponibilidad" },
  { href: "#reservas", text: "5. Reservas, pagos y comisiones" },
  { href: "#cancelaciones", text: "6. Cancelaciones y reembolsos" },
  { href: "#entregas", text: "7. Entrega, uso y devoluciones" },
  { href: "#seguros", text: "8. Protección, seguros y daños" },
  { href: "#conducta", text: "9. Conducta prohibida" },
  { href: "#contenido", text: "10. Contenido, reseñas y propiedad intelectual" },
  { href: "#responsabilidad", text: "11. Limitación de responsabilidad" },
  { href: "#disputas", text: "12. Disputas y resolución" },
  { href: "#modificaciones", text: "13. Modificaciones de los términos" },
  { href: "#contacto", text: "14. Contacto" },
];

// 1. Componente para la cabecera
const TermsHeader = () => (
  <header className="mb-12">
    <p className="text-card-loc text-subtle tracking-eyebrow mb-3 uppercase">Legal</p>
    <h1 className="text-2xl font-semibold">Términos y Condiciones</h1>
    <p className="text-body-color mt-4 max-w-3xl">
      Estos Términos y Condiciones regulan el acceso y uso de la plataforma MeRenta, un marketplace de alquiler entre
      particulares. Al crear una cuenta, publicar artículos, reservar o navegar por la plataforma, aceptas cumplir estos
      términos y la normativa aplicable.
    </p>
    <div className="text-card-sm text-subtle mt-4 flex flex-wrap gap-x-6 gap-y-2">
      <span>Última actualización: 25 de mayo de 2026</span>
      <span>Vigente desde: 1 de junio de 2026</span>
      <span>Versión: 1.0</span>
    </div>
  </header>
);

// 2. Componente para las tarjetas de resumen
const TermsSummary = () => (
  <section className="mb-10 grid gap-4 md:grid-cols-3">
    <div className="border-border-main bg-surface rounded-lg border p-5">
      <h2 className="text-body-lg text-ink font-semibold">Marketplace</h2>
      <p className="text-body-color mt-2">
        MeRenta conecta arrendadores y arrendatarios. No somos propietarios de los productos publicados ni parte de los
        acuerdos de alquiler.
      </p>
    </div>
    <div className="border-border-main bg-surface rounded-lg border p-5">
      <h2 className="text-body-lg text-ink font-semibold">Pagos seguros</h2>
      <p className="text-body-color mt-2">
        Los pagos se procesan mediante proveedores externos (p. ej., Stripe). Podemos retener fondos hasta confirmar la
        entrega y devolución.
      </p>
    </div>
    <div className="border-border-main bg-surface rounded-lg border p-5">
      <h2 className="text-body-lg text-ink font-semibold">Protección y soporte</h2>
      <p className="text-body-color mt-2">
        Ofrecemos mecanismos de soporte, reseñas y resolución de disputas para proteger a la comunidad, sin sustituir a
        la responsabilidad de las partes.
      </p>
    </div>
  </section>
);

// 3. Componente para la tabla de contenidos
const TermsTOC = () => {
  return (
    <nav
      className="border-border-main rounded-panel border bg-white p-6"
      aria-label="Tabla de contenidos"
    >
      <h2 className="text-body-lg text-ink font-semibold">Contenido</h2>
      <ul className="text-body-color mt-4 grid gap-2 md:grid-cols-2">
        {TERMS_TOC_LINKS.map((link) => (
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
const TermsContent = () => (
  <div className="mt-12 space-y-10">
    <Section
      id="aceptacion"
      title="1. Aceptación de los términos"
    >
      <p className="text-body-color">
        Al acceder o utilizar MeRenta, declaras que has leído, comprendido y aceptas estos Términos y Condiciones y
        nuestra Política de Privacidad. Si no estás de acuerdo, no utilices la plataforma.
      </p>
      <p className="text-body-color">
        También aceptas cumplir con todas las leyes y regulaciones aplicables, incluyendo las relacionadas con consumo,
        protección de datos, fiscalidad y comercio electrónico.
      </p>
    </Section>

    <Section
      id="definiciones"
      title="2. Definiciones"
    >
      <ul className="text-body-color list-disc space-y-2 pl-5">
        <li>
          <strong>Plataforma:</strong> el sitio web y aplicaciones de MeRenta, incluyendo servicios y APIs.
        </li>
        <li>
          <strong>Arrendador:</strong> usuario que publica un artículo para alquilar.
        </li>
        <li>
          <strong>Arrendatario:</strong> usuario que reserva y utiliza un artículo.
        </li>
        <li>
          <strong>Reserva:</strong> acuerdo temporal entre arrendador y arrendatario, sujeto a disponibilidad y pago.
        </li>
        <li>
          <strong>Contenido:</strong> textos, fotos, reseñas, mensajes y cualquier material generado por usuarios.
        </li>
      </ul>
    </Section>

    <Section
      id="cuentas"
      title="3. Cuentas y elegibilidad"
    >
      <p className="text-body-color">
        Debes tener al menos 18 años y capacidad legal para contratar. Eres responsable de la veracidad de la
        información de tu cuenta y de mantener la confidencialidad de tus credenciales.
      </p>
      <ul className="text-body-color list-disc space-y-2 pl-5">
        <li>No puedes usar cuentas ajenas ni suplantar a otras personas.</li>
        <li>
          Podemos solicitar verificaciones adicionales para reforzar la seguridad (documentos, teléfono o métodos de
          pago).
        </li>
        <li>Nos reservamos el derecho de suspender o cancelar cuentas que incumplan estos términos.</li>
      </ul>
    </Section>

    <Section
      id="publicaciones"
      title="4. Publicaciones y disponibilidad"
    >
      <p className="text-body-color">
        El arrendador es responsable de la exactitud de la descripción, fotos, estado del artículo, precio, condiciones,
        disponibilidad y ubicación. Los artículos deben ser legales y aptos para alquiler.
      </p>
      <ul className="text-body-color list-disc space-y-2 pl-5">
        <li>Se prohíben artículos peligrosos, ilegales o sujetos a licencias especiales.</li>
        <li>Las fotos deben ser reales y representar fielmente el estado del artículo.</li>
        <li>MeRenta puede retirar publicaciones que incumplan estas reglas.</li>
      </ul>
    </Section>

    <Section
      id="reservas"
      title="5. Reservas, pagos y comisiones"
    >
      <p className="text-body-color">
        Las reservas se confirman tras la aceptación del arrendador y el pago por parte del arrendatario. MeRenta puede
        aplicar comisiones de servicio y retener fondos hasta la finalización de la reserva.
      </p>
      <ul className="text-body-color list-disc space-y-2 pl-5">
        <li>Los pagos se procesan mediante proveedores externos autorizados.</li>
        <li>Los precios incluyen impuestos cuando sea aplicable o se detallan por separado.</li>
        <li>El arrendador es responsable de sus obligaciones fiscales derivadas de los ingresos.</li>
      </ul>
    </Section>

    <Section
      id="cancelaciones"
      title="6. Cancelaciones y reembolsos"
    >
      <p className="text-body-color">
        Las políticas de cancelación se muestran durante el proceso de reserva. El importe a reembolsar dependerá de
        cuándo se realice la cancelación y de la política aplicada por el arrendador.
      </p>
      <ul className="text-body-color list-disc space-y-2 pl-5">
        <li>Cancelaciones tardías pueden implicar cargos parciales o totales.</li>
        <li>En caso de fuerza mayor, evaluaremos alternativas según disponibilidad y normativa.</li>
        <li>Los reembolsos se procesan en el mismo método de pago, sujeto a tiempos bancarios.</li>
      </ul>
    </Section>

    <Section
      id="entregas"
      title="7. Entrega, uso y devoluciones"
    >
      <p className="text-body-color">
        Arrendador y arrendatario deben acordar lugar, fecha y condiciones de entrega y devolución. El arrendatario se
        compromete a utilizar el artículo con diligencia y devolverlo en el estado acordado.
      </p>
      <ul className="text-body-color list-disc space-y-2 pl-5">
        <li>Se recomienda documentar el estado del artículo al inicio y fin del alquiler.</li>
        <li>El uso indebido puede implicar compensaciones por daños o pérdida.</li>
        <li>Los accesorios deben devolverse completos salvo acuerdo previo.</li>
      </ul>
    </Section>

    <Section
      id="seguros"
      title="8. Protección, seguros y daños"
    >
      <p className="text-body-color">
        MeRenta puede ofrecer mecanismos de protección o seguros complementarios, sujetos a condiciones específicas que
        se detallan durante la reserva. La cobertura puede variar según el artículo y la duración.
      </p>
      <ul className="text-body-color list-disc space-y-2 pl-5">
        <li>No todas las incidencias están cubiertas (p. ej., desgaste normal).</li>
        <li>Las reclamaciones deben presentarse dentro de los plazos indicados.</li>
        <li>En caso de disputa, se requerirá evidencia (fotos, mensajes y comprobantes).</li>
      </ul>
    </Section>

    <Section
      id="conducta"
      title="9. Conducta prohibida"
    >
      <p className="text-body-color">Para proteger a la comunidad, queda prohibido:</p>
      <ul className="text-body-color list-disc space-y-2 pl-5">
        <li>Publicar contenido falso, engañoso o ilegal.</li>
        <li>Realizar pagos fuera de la plataforma para evitar comisiones o controles.</li>
        <li>Usar la plataforma para spam, fraude o acoso.</li>
        <li>Infringir derechos de terceros o vulnerar propiedad intelectual.</li>
      </ul>
    </Section>

    <Section
      id="contenido"
      title="10. Contenido, reseñas y propiedad intelectual"
    >
      <p className="text-body-color">
        Conservas la titularidad de tu contenido, pero otorgas a MeRenta una licencia no exclusiva, mundial y gratuita
        para mostrarlo, reproducirlo y distribuirlo dentro de la plataforma con fines operativos.
      </p>
      <ul className="text-body-color list-disc space-y-2 pl-5">
        <li>Las reseñas deben ser veraces, respetuosas y basadas en experiencias reales.</li>
        <li>Podemos moderar o retirar contenido que viole estos términos.</li>
        <li>El software, marca y diseño de MeRenta están protegidos por propiedad intelectual.</li>
      </ul>
    </Section>

    <Section
      id="responsabilidad"
      title="11. Limitación de responsabilidad"
    >
      <p className="text-body-color">
        MeRenta actúa como intermediario y no garantiza la calidad, seguridad o legalidad de los artículos. No seremos
        responsables por daños indirectos, pérdida de beneficios o incidencias derivadas del uso del servicio, salvo en
        casos en los que la ley lo prohíba.
      </p>
      <p className="text-body-color">
        Cada usuario es responsable de su conducta y del cumplimiento de sus obligaciones.
      </p>
    </Section>

    <Section
      id="disputas"
      title="12. Disputas y resolución"
    >
      <p className="text-body-color">
        Si surge un conflicto, recomendamos resolverlo primero entre las partes. Si no es posible, nuestro equipo podrá
        intervenir como mediador y solicitar pruebas.
      </p>
      <ul className="text-body-color list-disc space-y-2 pl-5">
        <li>Las decisiones se basan en la evidencia aportada.</li>
        <li>Podemos suspender temporalmente pagos hasta resolver la incidencia.</li>
        <li>El uso continuado de la plataforma implica la aceptación de estos mecanismos.</li>
      </ul>
    </Section>

    <Section
      id="modificaciones"
      title="13. Modificaciones de los términos"
    >
      <p className="text-body-color">
        Podemos actualizar estos términos para reflejar cambios legales o funcionales. Te notificaremos los cambios
        relevantes y la fecha de entrada en vigor. El uso continuado de la plataforma tras la actualización implica la
        aceptación de los nuevos términos.
      </p>
    </Section>

    <Section
      id="contacto"
      title="14. Contacto"
    >
      <p className="text-body-color">
        Para consultas legales o soporte relacionado con estos términos, puedes escribirnos a
        <a
          className="link-section ml-1"
          href="mailto:contact@merenta.com"
        >
          contact@merenta.com
        </a>
        .
      </p>
      <p className="text-body-color">
        Consulta para conocer cómo tratamos tus datos nuestra
        <Link
          className="link-section ml-1"
          to="/privacy"
        >
          Política de Privacidad.
        </Link>
      </p>
    </Section>
  </div>
);

/**
 * Legal terms and conditions page.
 * @returns The terms and conditions content.
 */
function Terms() {
  return (
    <div className="bg-page">
      <div className="max-w-alert-width px-layout-margin mx-auto py-16">
        <TermsHeader />
        <TermsSummary />
        <TermsTOC />
        <TermsContent />
      </div>
    </div>
  );
}

export { Terms };
