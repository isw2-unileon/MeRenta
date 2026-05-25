import type { ChangeEvent } from "react";

import type { CategoryOption, ProductFormData } from "@/types/item";

/**
 * Available categories aligned with the backend CategoryEnum.
 */
const CATEGORIES: CategoryOption[] = [
  {
    value: "sports",
    label: "Deportes",
    subcategories: ["Ciclismo", "Running", "Natación", "Montañismo", "Esquí", "Patinaje", "Surf", "Otros"],
  },
  {
    value: "electronics",
    label: "Electrónica",
    subcategories: ["Portátiles", "Tablets", "Proyectores", "Audio", "Gaming", "Fotografía", "Otros"],
  },
  {
    value: "tools",
    label: "Herramientas",
    subcategories: ["Eléctricas", "Manuales", "Jardinería", "Construcción", "Fontanería", "Otros"],
  },
  {
    value: "music",
    label: "Música",
    subcategories: ["Guitarra", "Batería", "Teclado", "Viento", "Cuerda", "DJ", "Otros"],
  },
  {
    value: "photography",
    label: "Fotografia",
    subcategories: ["Camaras", "Objetivos", "Iluminacion", "Tripodes", "Accesorios", "Otros"],
  },
  {
    value: "gardening",
    label: "Jardineria",
    subcategories: ["Maquinaria", "Muebles de exterior", "Riego", "Herramientas", "Otros"],
  },
  {
    value: "camping",
    label: "Camping",
    subcategories: ["Tiendas", "Mochilas", "Sacos", "Iluminacion", "Otros"],
  },
  {
    value: "home",
    label: "Hogar",
    subcategories: ["Electrodomésticos", "Muebles", "Decoración", "Limpieza", "Otros"],
  },
  {
    value: "clothing",
    label: "Ropa",
    subcategories: ["Hombre", "Mujer", "Niños", "Accesorios", "Disfraces", "Otros"],
  },
  {
    value: "vehicles",
    label: "Vehículos",
    subcategories: ["Coches", "Motos", "Bicicletas", "Patinetes", "Furgonetas", "Otros"],
  },
  {
    value: "other",
    label: "Otros",
    subcategories: ["Otros"],
  },
];

/**
 * Product conservation state options.
 */
const CONDITIONS = [
  { value: "new", label: "Nuevo", fullLabel: "Nuevo — Nunca usado, con embalaje original" },
  { value: "like_new", label: "Excelente", fullLabel: "Excelente — Como nuevo, sin marcas de uso" },
  { value: "good", label: "Muy bueno", fullLabel: "Muy bueno — Uso mínimo, algún pequeño detalle" },
  { value: "fair", label: "Bueno", fullLabel: "Bueno — Uso normal, funciona perfectamente" },
  { value: "poor", label: "Aceptable", fullLabel: "Aceptable — Visible desgaste" },
];

interface BasicInfoSectionProps {
  data: Pick<ProductFormData, "title" | "category" | "subcategory" | "condition" | "description">;
  errors: Partial<Record<string, string>>;
  onChange: (field: keyof ProductFormData, value: string) => void;
}

/**
 * Form section for the basic product listing info: title, category, condition and description.
 * @param data Current field values.
 * @param errors Validation error messages keyed by field name.
 * @param onChange Callback to update a single field.
 * @returns The basic-info section JSX.
 */
function BasicInfoSection({ data, errors, onChange }: BasicInfoSectionProps) {
  const selectedCategory = CATEGORIES.find((c) => c.value === data.category);

  const updateBasicInfoField = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === "category") {
      onChange("subcategory", "");
    }
    onChange(name as keyof ProductFormData, value);
  };

  return (
    <section className="border-border-main rounded-xl border bg-white p-6">
      <h4 className="heading-content mb-1">Información básica</h4>
      <p className="field-hint mb-6">Cuéntanos qué estás alquilando. Sé claro y específico.</p>

      <div className="flex flex-col gap-5">
        {/* Title */}
        <div>
          <label
            htmlFor="title"
            className="required"
          >
            Título del anuncio
          </label>
          <input
            id="title"
            name="title"
            type="text"
            placeholder="Ej: Bicicleta de montaña Trek X-Caliber 8"
            maxLength={80}
            aria-label="Título del anuncio"
            value={data.title}
            onChange={updateBasicInfoField}
            className={errors.title ? "input-error" : ""}
          />
          <div className="mt-1 flex items-start justify-between gap-4">
            {errors.title ? (
              <p className="field-error">{errors.title}</p>
            ) : (
              <p className="field-hint">
                Máximo 80 caracteres. Sé descriptivo: marca, modelo y característica principal.
              </p>
            )}
            <p className="field-hint shrink-0">{data.title.length}/80</p>
          </div>
        </div>

        {/* Category + Subcategory */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="category"
              className="required"
            >
              Categoría
            </label>
            <select
              id="category"
              name="category"
              value={data.category}
              onChange={updateBasicInfoField}
              className={errors.category ? "input-error" : ""}
            >
              <option value="">Selecciona una categoría</option>
              {CATEGORIES.map((cat) => (
                <option
                  key={cat.value}
                  value={cat.value}
                >
                  {cat.label}
                </option>
              ))}
            </select>
            {errors.category && <p className="field-error mt-1">{errors.category}</p>}
          </div>

          <div>
            <label htmlFor="subcategory">Subcategoría</label>
            <select
              id="subcategory"
              name="subcategory"
              value={data.subcategory}
              onChange={updateBasicInfoField}
              disabled={!data.category}
            >
              <option value="">Selecciona subcategoría</option>
              {selectedCategory?.subcategories.map((sub) => (
                <option
                  key={sub}
                  value={sub}
                >
                  {sub}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Condition */}
        <div>
          <label
            htmlFor="condition"
            className="required"
          >
            Estado de conservación
          </label>
          <select
            id="condition"
            name="condition"
            value={data.condition}
            onChange={updateBasicInfoField}
            className={errors.condition ? "input-error" : ""}
          >
            <option value="">Selecciona el estado</option>
            {CONDITIONS.map((c) => (
              <option
                key={c.value}
                value={c.value}
              >
                {c.fullLabel}
              </option>
            ))}
          </select>
          {errors.condition && <p className="field-error mt-1">{errors.condition}</p>}
        </div>

        {/* Description */}
        <div>
          <label
            htmlFor="description"
            className="required"
          >
            Descripción completa
          </label>
          <textarea
            id="description"
            name="description"
            rows={5}
            placeholder="Describe el producto con detalle: características técnicas, accesorios incluidos, historial de uso, condiciones de alquiler..."
            aria-label="Descripción completa"
            value={data.description}
            onChange={updateBasicInfoField}
            className={`min-h-[128px] ${errors.description ? "input-error" : ""}`}
          />
          <div className="mt-1 flex items-start justify-between gap-4">
            {errors.description ? (
              <p className="field-error">{errors.description}</p>
            ) : (
              <p className="field-hint">Mínimo 100 caracteres. Cuanto más detallada, más confianza genera.</p>
            )}
            <p className="field-hint shrink-0">{data.description.length}/2000</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export { BasicInfoSection, CATEGORIES, CONDITIONS };
