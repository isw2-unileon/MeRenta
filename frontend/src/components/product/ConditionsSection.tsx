import type { ChangeEvent } from "react";

interface ConditionsSectionProps {
  value: string;
  onChange: (value: string) => void;
}

/**
 * Form section for the tenant usage rules (optional).
 * @param value Current textarea content.
 * @param onChange Callback with updated text.
 * @returns The conditions-for-tenant section JSX.
 */
function ConditionsSection({ value, onChange }: ConditionsSectionProps) {
  const updateUsageRules = (e: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  return (
    <section className="border-border-main rounded-xl border bg-white p-6">
      <h4 className="heading-content mb-1">Condiciones para el arrendatario</h4>
      <p className="field-hint mb-6">Define tus reglas para el uso del producto.</p>

      <div>
        <label htmlFor="usageRules">Normas de uso</label>
        <textarea
          id="usageRules"
          name="usageRules"
          rows={4}
          placeholder="Ej: No usar en competición. Devolver limpio. Notificar cualquier desperfecto inmediatamente..."
          value={value}
          aria-label="Normas de uso"
          onChange={updateUsageRules}
          className="min-h-28"
        />
        <p className="field-hint mt-1">Opcional pero muy recomendable. Protege tu producto.</p>
      </div>
    </section>
  );
}

export { ConditionsSection };
