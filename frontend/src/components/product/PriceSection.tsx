import type { ChangeEvent } from "react";
import { ShieldCheck } from "lucide-react";

import type { ProductFormData } from "@/types/item";

const MIN_PERIOD_OPTIONS = [
  { value: "1", label: "1 día" },
  { value: "2", label: "2 días" },
  { value: "3", label: "3 días" },
  { value: "7", label: "1 semana" },
  { value: "14", label: "2 semanas" },
];

const MAX_PERIOD_OPTIONS = [
  { value: "3", label: "3 días" },
  { value: "7", label: "7 días" },
  { value: "14", label: "14 días" },
  { value: "30", label: "30 días" },
  { value: "90", label: "3 meses" },
  { value: "0", label: "Sin límite" },
];

interface PriceSectionProps {
  data: Pick<ProductFormData, "pricePerDay" | "pricePerWeek" | "deposit" | "minRentalPeriod" | "maxRentalPeriod">;
  errors: Partial<Record<string, string>>;
  onChange: (field: keyof ProductFormData, value: string) => void;
}

const parseRentalPeriod = (value: string) => Number.parseInt(value, 10);

const isUnlimitedPeriod = (value: string) => value === "0";

/**
 * Form section for pricing, deposit and rental period configuration.
 * @param data Current price field values.
 * @param errors Validation error messages keyed by field name.
 * @param onChange Callback to update a single field.
 * @returns The price-and-conditions section JSX.
 */
function PriceSection({ data, errors, onChange }: PriceSectionProps) {
  const updatePricingField = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const field = e.target.name as keyof ProductFormData;
    const { value } = e.target;

    if (field === "minRentalPeriod") {
      onChange(field, value);

      const nextMin = parseRentalPeriod(value);
      const currentMax = parseRentalPeriod(data.maxRentalPeriod);
      if (!isUnlimitedPeriod(data.maxRentalPeriod) && currentMax < nextMin) {
        onChange("maxRentalPeriod", value);
      }

      return;
    }

    if (field === "maxRentalPeriod") {
      onChange(field, value);

      const currentMin = parseRentalPeriod(data.minRentalPeriod);
      const nextMax = parseRentalPeriod(value);
      if (!isUnlimitedPeriod(value) && currentMin > nextMax) {
        onChange("minRentalPeriod", value);
      }

      return;
    }

    onChange(field, value);
  };

  const selectedMax = parseRentalPeriod(data.maxRentalPeriod);
  const selectedMin = parseRentalPeriod(data.minRentalPeriod);

  const minPeriodOptions = MIN_PERIOD_OPTIONS.filter(
    (opt) => isUnlimitedPeriod(data.maxRentalPeriod) || parseRentalPeriod(opt.value) <= selectedMax
  );
  const maxPeriodOptions = MAX_PERIOD_OPTIONS.filter(
    (opt) => isUnlimitedPeriod(opt.value) || parseRentalPeriod(opt.value) >= selectedMin
  );

  return (
    <section className="border-border-main rounded-xl border bg-white p-6">
      <h4 className="heading-content mb-1">Precio y condiciones</h4>
      <p className="field-hint mb-6">Define cuánto cobras y en qué términos alquilas.</p>

      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label
              htmlFor="pricePerDay"
              className="required"
            >
              Precio por día (EUR)
            </label>
            <input
              id="pricePerDay"
              name="pricePerDay"
              type="number"
              min="0"
              step="0.01"
              placeholder="18"
              aria-label="Precio por día"
              value={data.pricePerDay}
              onChange={updatePricingField}
              className={errors.pricePerDay ? "input-error" : ""}
            />
            {errors.pricePerDay && <p className="field-error mt-1">{errors.pricePerDay}</p>}
          </div>

          <div>
            <label htmlFor="pricePerWeek">Precio por semana (opcional)</label>
            <input
              id="pricePerWeek"
              name="pricePerWeek"
              type="number"
              min="0"
              step="0.01"
              placeholder="100"
              aria-label="Precio por semana"
              value={data.pricePerWeek}
              onChange={updatePricingField}
            />
            <p className="field-hint mt-1">Si lo dejas vacío se calcula automáticamente x7</p>
          </div>

          <div>
            <label htmlFor="deposit">Depósito de garantía (EUR)</label>
            <input
              id="deposit"
              name="deposit"
              type="number"
              min="0"
              step="0.01"
              placeholder="50"
              aria-label="Depósito de garantía"
              value={data.deposit}
              onChange={updatePricingField}
            />
            <p className="field-hint mt-1">Descuento al finalizar sin incidencias</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="minRentalPeriod">Período mínimo de alquiler</label>
            <select
              id="minRentalPeriod"
              name="minRentalPeriod"
              value={data.minRentalPeriod}
              onChange={updatePricingField}
              className={errors.minRentalPeriod ? "input-error" : ""}
            >
              {minPeriodOptions.map((opt) => (
                <option
                  key={opt.value}
                  value={opt.value}
                >
                  {opt.label}
                </option>
              ))}
            </select>
            {errors.minRentalPeriod && <p className="field-error mt-1">{errors.minRentalPeriod}</p>}
          </div>

          <div>
            <label htmlFor="maxRentalPeriod">Período máximo de alquiler</label>
            <select
              id="maxRentalPeriod"
              name="maxRentalPeriod"
              value={data.maxRentalPeriod}
              onChange={updatePricingField}
              className={errors.maxRentalPeriod ? "input-error" : ""}
            >
              {maxPeriodOptions.map((opt) => (
                <option
                  key={opt.value}
                  value={opt.value}
                >
                  {opt.label}
                </option>
              ))}
            </select>
            {errors.maxRentalPeriod && <p className="field-error mt-1">{errors.maxRentalPeriod}</p>}
          </div>
        </div>

        <div className="border-primary-border bg-insurance flex items-start gap-3 rounded-lg border p-4">
          <ShieldCheck className="text-primary mt-0.5 size-5 shrink-0" />
          <div>
            <p className="text-primary text-[13px] font-semibold">Seguro obligatorio incluido en cada alquiler</p>
            <p className="auth-info-box-text mt-0.5">
              MeRenta calcula automáticamente la prima del seguro según el valor del producto y la duración. El
              inquilino lo abona al reservar.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export { PriceSection };
