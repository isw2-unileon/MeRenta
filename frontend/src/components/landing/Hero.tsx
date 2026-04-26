import { useNavigate } from "react-router-dom";

function Hero() {
  const navigate = useNavigate();

  return (
    <section className="px-layout-margin pt-[64px] pb-[80px]">
      <div className="max-w-alert-width mx-auto flex items-start gap-[64px]">
        <div className="flex-1 pt-2">
          <div className="rounded-pill bg-primary-light mb-[28px] inline-flex h-7.5 items-center px-4">
            <span className="text-card-sm text-primary font-medium">Marketplace de alquileres entre particulares</span>
          </div>

          <h1 className="mb-[28px]">
            Alquila lo que necesitas, <span className="text-primary">gana con lo que tienes</span>
          </h1>

          <p className="subtitle mb-[40px]">
            Conectamos personas que quieren sacar partido a sus
            <br />
            objetos
            <br />
            con quienes los necesitan por dias. Sin intermediarios, con
            <br />
            total seguridad.
          </p>

          <div className="flex items-center gap-3">
            <button
              className="btn-primary btn--xl"
              onClick={() => navigate("/auth")}
            >
              Empieza ahora
            </button>
            <button
              className="btn-secondary btn--xl"
              onClick={() => navigate("/auth")}
            >
              Identifícate
            </button>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-4">
          <div className="bg-page border-border-main overflow-hidden rounded-xl border">
            <div className="bg-ghost h-45 w-full" />
            <div className="flex flex-col gap-2.5 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="card-title">Bicicleta de Montaña Trek</p>
                  <p className="card-location mt-0.5">Madrid · Estado excelente</p>
                </div>
                <div className="product-status-badge">Disponible</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[
              {
                name: "Camara Sony A7",
                location: "Barcelona",
                price: "35 EUR/dia",
              },
              {
                name: "Tienda de campaña",
                location: "Valencia",
                price: "12 EUR/dia",
              },
            ].map((item) => (
              <div
                key={item.name}
                className="bg-page border-border-main overflow-hidden rounded-xl border"
              >
                <div className="bg-primary-light h-[100px] w-full" />
                <div className="flex flex-col gap-1 p-3">
                  <p className="card-title">{item.name}</p>
                  <p className="card-location">{item.location}</p>
                  <p className="card-price">{item.price}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export { Hero };
