import { insuranceDailyRate } from "@/components/product/insurance";

const COVERAGE_ITEMS = [
  {
    title: "Daños accidentales",
    desc: "Cubre roturas o daños no intencionados",
  },
  {
    title: "Robo o pérdida",
    desc: "Protección ante sustracción durante el alquiler",
  },
  {
    title: "Responsabilidad civil",
    desc: "Cubre daños a terceros causados con el producto",
  },
] as const;

interface InsuranceCardProps {
  /** Number of rental days, used to compute the total premium. */
  days: number;
  /** Product category — determines the per-day premium. */
  category?: string;
  /** Override the per-day rate. Defaults to the category-based rate. */
  dailyRate?: number;
}

/**
 * Static information card explaining the mandatory insurance included in every
 * MeRenta rental. Lists the coverage items and shows the premium for the
 * currently selected rental period. The per-day premium varies by category.
 * @param days Number of days selected in the booking card.
 * @param category Product category used to derive the per-day rate.
 * @param dailyRate Optional override for the per-day insurance cost in EUR.
 * @returns Insurance card JSX.
 */
function InsuranceCard({ days, category, dailyRate = insuranceDailyRate(category) }: InsuranceCardProps) {
  const effectiveDays = Math.max(days, 1);
  const premium = (dailyRate * effectiveDays).toFixed(2).replace(".", ",");
  const rateLabel = dailyRate.toFixed(2).replace(".", ",");
  const daysLabel = days <= 1 ? "1 día" : `${days} días`;

  return (
    <div className="insurance-card">
      {/* ── Header ── */}
      <div className="insurance-card-header">
        <div className="flex flex-1 items-center gap-2">
          <p className="insurance-header-title">Seguro obligatorio</p>
          <span className="badge-obligatorio badge-obligatorio--on-primary">OBLIGATORIO</span>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="p-5">
        <p className="insurance-body mb-5">
          Todo alquiler en MeRenta incluye un seguro obligatorio que cubre tanto al propietario como al inquilino
          durante todo el periodo de alquiler.
        </p>

        <ul className="insurance-coverage-list">
          {COVERAGE_ITEMS.map((item) => (
            <li
              key={item.title}
              className="flex items-start gap-3"
            >
              <span className="insurance-check-icon mt-0.5 flex-shrink-0">✓</span>
              <div>
                <p className="insurance-item-title">{item.title}</p>
                <p className="insurance-item-desc">{item.desc}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* ── Footer: premium ── */}
      <div className="insurance-card-footer">
        <p className="insurance-prime-label flex-1">
          Prima del seguro ({rateLabel} EUR/día · {daysLabel})
        </p>
        <p className="insurance-prime-value">{premium} EUR</p>
      </div>
    </div>
  );
}

export { InsuranceCard };
