import { useNavigate } from "react-router-dom";

import type { SearchItemResponse } from "@/types/item";

interface HeroProps {
  featured: SearchItemResponse[];
}

/** Formats a daily price as a rounded euro amount. */
function priceLabel(item: SearchItemResponse): string {
  return `${Math.round(item.price_per_day)} EUR/día`;
}

/** Large showcase card for the first featured listing. */
function FeaturedHeadline({ item }: { item: SearchItemResponse }) {
  return (
    <div className="bg-page border-border-main overflow-hidden rounded-xl border">
      {item.primary_image_url ? (
        <img
          src={item.primary_image_url}
          alt={item.title}
          className="h-45 w-full object-cover"
        />
      ) : (
        <div className="bg-ghost h-45 w-full" />
      )}
      <div className="flex flex-col gap-2.5 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="card-title">{item.title}</p>
            <p className="card-location mt-0.5">
              {item.city || "Sin ubicación"} · {priceLabel(item)}
            </p>
          </div>
          <div className="product-status-badge">Disponible</div>
        </div>
      </div>
    </div>
  );
}

/** Compact showcase card for a secondary featured listing. */
function FeaturedCard({ item }: { item: SearchItemResponse }) {
  return (
    <div className="bg-page border-border-main overflow-hidden rounded-xl border">
      {item.primary_image_url ? (
        <img
          src={item.primary_image_url}
          alt={item.title}
          className="h-[100px] w-full object-cover"
        />
      ) : (
        <div className="bg-primary-light h-[100px] w-full" />
      )}
      <div className="flex flex-col gap-1 p-3">
        <p className="card-title">{item.title}</p>
        <p className="card-location">{item.city || "Sin ubicación"}</p>
        <p className="card-price">{priceLabel(item)}</p>
      </div>
    </div>
  );
}

/**
 * Highlights the main value proposition and primary calls to action,
 * showcasing real recently published listings.
 * @returns The landing hero section with CTA buttons and featured listings.
 */
function Hero({ featured }: HeroProps) {
  const navigate = useNavigate();

  const headline = featured[0];
  const secondary = featured.slice(1, 3);

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
            Conectamos personas que quieren sacar partido a sus objetos con quienes los necesitan por días. Sin
            intermediarios, con total seguridad.
          </p>

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="btn-primary btn--xl"
              onClick={() => navigate("/auth", { state: { view: "register" } })}
            >
              Empieza ahora
            </button>
            <button
              type="button"
              className="btn-secondary btn--xl"
              onClick={() => navigate("/auth", { state: { view: "login" } })}
            >
              Identifícate
            </button>
          </div>
        </div>

        {headline && (
          <div className="flex flex-1 flex-col gap-4">
            <FeaturedHeadline item={headline} />

            {secondary.length > 0 && (
              <div className="grid grid-cols-2 gap-4">
                {secondary.map((item) => (
                  <FeaturedCard
                    key={item.item_id}
                    item={item}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export { Hero };
