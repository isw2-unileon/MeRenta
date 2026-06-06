/**
 * Mock insurance pricing.
 *
 * The mandatory rental insurance premium is derived from the product category
 * instead of a flat rate: higher-value or higher-risk categories (vehicles,
 * electronics, photography) cost more per day than low-risk ones (clothing,
 * home). These are mock values computed on the fly — there is no insurance
 * table in the database.
 */

/** Per-day insurance premium (EUR) by product category. */
const INSURANCE_DAILY_RATES: Record<string, number> = {
  vehicles: 4.5,
  electronics: 3.5,
  photography: 3.5,
  music: 3.0,
  sports: 2.5,
  camping: 2.5,
  tools: 2.0,
  gardening: 2.0,
  leisure: 1.8,
  home: 1.8,
  clothing: 1.2,
  other: 2.3,
};

/** Fallback per-day rate for unknown / missing categories. */
const DEFAULT_INSURANCE_DAILY_RATE = 2.3;

/**
 * Returns the per-day insurance premium (EUR) for a product category.
 * Unknown categories fall back to the default rate.
 *
 * @param category Item category key (e.g. "electronics", "vehicles").
 * @returns The daily insurance premium in EUR.
 */
function insuranceDailyRate(category: string | undefined): number {
  if (!category) return DEFAULT_INSURANCE_DAILY_RATE;
  return INSURANCE_DAILY_RATES[category] ?? DEFAULT_INSURANCE_DAILY_RATE;
}

/**
 * Computes the total insurance premium for a rental, rounded to cents.
 *
 * @param category Item category key.
 * @param days Number of rental days (clamped to a minimum of 1).
 * @returns The total premium in EUR.
 */
function insurancePremium(category: string | undefined, days: number): number {
  const effectiveDays = Math.max(days, 1);
  return Math.round(insuranceDailyRate(category) * effectiveDays * 100) / 100;
}

export { DEFAULT_INSURANCE_DAILY_RATE, insuranceDailyRate, insurancePremium };
