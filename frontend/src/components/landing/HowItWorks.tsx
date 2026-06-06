/**
 * Key onboarding steps shown on the landing page.
 */
const steps = [
  {
    number: "01",
    title: "Encuentra o publica",
    desc: "Busca lo que necesitas entre miles de productos cercanos, o publica los tuyos en minutos.",
  },
  {
    number: "02",
    title: "Reserva con seguridad",
    desc: "Selecciona fechas, contrata el seguro incluido y paga de forma segura con Stripe.",
  },
  {
    number: "03",
    title: "Disfruta y devuelve",
    desc: "Recibe el producto, úsalo y devuélvelo. Todo el proceso esta protegido y verificado.",
  },
];

/**
 * Explains the rental flow in three short steps.
 * @returns The "How it works" section for the landing page.
 */
function HowItWorks() {
  return (
    <section
      id="como-funciona"
      className="px-layout-margin pb-error-icon pt-[24px]"
    >
      <div className="max-w-alert-width mx-auto">
        <span className="eyebrow">SENCILLO Y SEGURO</span>
        <h2 className="mt-3 mb-[48px]">¿Cómo funciona?</h2>

        <div className="grid grid-cols-3 gap-[40px]">
          {steps.map((step) => (
            <div
              key={step.number}
              className="flex flex-col gap-3"
            >
              <span className="step-number">{step.number}</span>
              <h4>{step.title}</h4>
              <p className="step-desc">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export { HowItWorks };
