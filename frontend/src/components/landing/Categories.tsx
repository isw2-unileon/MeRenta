import { useNavigate } from "react-router-dom";

import { buildCategoryChips } from "@/components/landing/landingFormat";
import type { LandingCategory } from "@/types/landing";

interface CategoriesProps {
  categories: LandingCategory[];
}

/**
 * Lists the real categories that currently have available products.
 * Browsing requires an account, so chips lead to the auth screen.
 * @returns The category section for the landing page, or null when empty.
 */
function Categories({ categories }: CategoriesProps) {
  const navigate = useNavigate();
  const chips = buildCategoryChips(categories);

  if (chips.length === 0) return null;

  return (
    <section
      id="categorías"
      className="px-layout-margin pt-error-icon pb-[56px]"
    >
      <div className="max-w-alert-width mx-auto">
        <span className="eyebrow">EXPLORA POR CATEGORÍAS</span>
        <h2 className="mt-3 mb-[32px]">Encuentra lo que necesitas</h2>

        <ul className="category-list">
          {chips.map((chip) => (
            <li key={chip.value}>
              <button
                type="button"
                className="btn-secondary btn--md"
                onClick={() => navigate("/auth", { state: { view: "register" } })}
              >
                {chip.label}
                <span className="text-subtle ml-2">{chip.count}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export { Categories };
