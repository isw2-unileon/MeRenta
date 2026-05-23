import { useMemo } from "react";
import { MapPin, ImageIcon } from "lucide-react";

import { CATEGORIES, CONDITIONS } from "@/components/product/BasicInfoSection";
import type { ProductFormData } from "@/types/item";

interface PreviewPanelProps {
  formData: ProductFormData;
}

/**
 * Sticky right-side panel that shows a live preview of the listing card
 * as the user fills in the creation form.
 * @param formData The current form state to render.
 * @returns The preview panel JSX.
 */
function PreviewPanel({ formData }: PreviewPanelProps) {
  const { title, category, condition, pricePerDay, deposit, minRentalPeriod, city, availableNow, photos } = formData;

  const categoryLabel = useMemo(
    () => CATEGORIES.find((c) => c.value === category)?.label ?? "",
    [category]
  );

  const conditionLabel = useMemo(
    () => CONDITIONS.find((c) => c.value === condition)?.label ?? "",
    [condition]
  );

  const cityLabel = useMemo(() => {
    if (!city) return "";
    // Extract city name before the dash separator
    return city
      .split("-")
      .slice(0, -1)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }, [city]);

  const previewPrice = pricePerDay ? parseFloat(pricePerDay) : null;
  const previewDeposit = deposit ? parseFloat(deposit) : null;
  const minDays = minRentalPeriod ? parseInt(minRentalPeriod, 10) : 1;

  const firstPhoto = photos[0] ? URL.createObjectURL(photos[0]) : null;

  const hasContent = title || categoryLabel || conditionLabel || previewPrice;

  return (
    <aside className="sticky top-[calc(var(--spacing-navbar)+24px)] flex flex-col gap-4">
      <p className="text-[13px] font-medium text-subtle">Vista previa del anuncio</p>

      {/* Preview card */}
      <div className="overflow-hidden rounded-xl border border-border-main bg-white shadow-sm">
        {/* Photo area */}
        <div className="relative flex h-40 items-center justify-center bg-primary-bg">
          {firstPhoto ? (
            <img
              src={firstPhoto}
              alt="Imagen principal"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-primary/40">
              <ImageIcon className="size-10" />
              <p className="text-[11px]">Sin imagen</p>
            </div>
          )}

          {availableNow && (
            <span className="product-status-badge absolute top-3 left-3">Disponible</span>
          )}
        </div>

        {/* Card body */}
        <div className="p-4">
          {/* Title */}
          <p className="line-clamp-2 text-[15px] font-medium text-ink">
            {title || (
              <span className="italic text-placeholder">Bicicleta de montaña Trek X-Caliber 8</span>
            )}
          </p>

          {/* Location */}
          {cityLabel && (
            <div className="mt-1.5 flex items-center gap-1">
              <MapPin className="size-3 text-subtle" />
              <p className="card-location">{cityLabel}</p>
            </div>
          )}

          {/* Tags */}
          {(categoryLabel || conditionLabel) && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {categoryLabel && (
                <span className="inline-flex h-[22px] items-center rounded-full bg-primary-bg px-2.5 text-[11px] font-medium text-primary">
                  {categoryLabel}
                </span>
              )}
              {conditionLabel && (
                <span className="product-estado-badge">{conditionLabel}</span>
              )}
            </div>
          )}

          {/* Price */}
          <div className="mt-3">
            {previewPrice ? (
              <p className="text-[28px] font-bold leading-none text-primary">
                {previewPrice.toFixed(0)} EUR
                <span className="text-[14px] font-medium text-subtle">/día</span>
              </p>
            ) : (
              <p className="text-[28px] font-bold leading-none text-primary/30">
                — EUR<span className="text-[14px] font-medium">/día</span>
              </p>
            )}

            <div className="mt-1 flex items-center gap-2 text-[12px] text-subtle">
              {previewDeposit !== null && previewDeposit > 0 && (
                <span>Depósito: {previewDeposit.toFixed(0)} EUR</span>
              )}
              {previewDeposit !== null && previewDeposit > 0 && (
                <span className="text-border-main">·</span>
              )}
              <span>
                Mín.{" "}
                {minDays === 1
                  ? "1 día"
                  : minDays < 7
                    ? `${minDays} días`
                    : minDays === 7
                      ? "1 semana"
                      : "2 semanas"}
              </span>
            </div>
          </div>

          {/* CTA */}
          <button
            type="button"
            className="btn-booking mt-4"
            disabled
          >
            Solicitar alquiler
          </button>
        </div>
      </div>

      <p className="text-center text-[11px] text-subtle">
        Así verá tu anuncio el comprador. Se actualiza en tiempo real.
      </p>

      {!hasContent && (
        <p className="rounded-lg border border-border-main bg-surface p-3 text-center text-[12px] text-subtle">
          Completa el formulario para ver la vista previa
        </p>
      )}
    </aside>
  );
}

export { PreviewPanel };
