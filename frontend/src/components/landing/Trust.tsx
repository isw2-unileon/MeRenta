import { useNavigate } from "react-router-dom";

const cards = [
  {
    title: "Seguro incluido",
    desc: "Cobertura para danos, robo o perdida.",
  },
  {
    title: "Valoraciones reales",
    desc: "Sistema de reputacion verificado.",
  },
  {
    title: "Pago seguro",
    desc: "Integracion Stripe. Tu dinero protegido.",
  },
  {
    title: "Soporte directo",
    desc: "Mensajeria integrada entre partes.",
  },
];

function Trust() {
  const navigate = useNavigate();

  return (
    <section className="px-layout-margin bg-trust py-profile-stats">
      <div className="max-w-alert-width mx-auto flex items-start gap-18">
        <div className="flex flex-1 flex-col gap-[24px]">
          <h2 className="heading-on-primary">Tu tranquilidad es nuestra prioridad</h2>
          <p className="on-primary">
            Cada alquiler en MeRenta esta respaldado por un seguro que protege tanto al propietario como al inquilino
            ante cualquier incidente.
          </p>
          <div className="pt-2">
            <button
              className="btn-on-primary btn--xl"
              onClick={() => navigate("/more-info")}
            >
              Saber mas sobre los seguros
            </button>
          </div>
        </div>

        <div className="flex-1">
          <ul className="trust-list">
            {cards.map((card) => (
              <li key={card.title}>
                <p className="text-body mb-1.5 font-medium text-white">{card.title}</p>
                <p className="on-primary-muted">{card.desc}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export { Trust };
