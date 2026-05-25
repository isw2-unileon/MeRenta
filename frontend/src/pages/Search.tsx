import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Heart, Search as SearchIcon, Star, X } from "lucide-react";

import type { ApiResponse } from "@/types/common";
import type { SearchItemResponse, SearchItemsResponse } from "@/types/item";

const PAGE_SIZE = 12;

const CATEGORY_LABELS: Record<string, string> = {
  electronics: "Electronica",
  tools: "Herramientas",
  sports: "Deportes",
  vehicles: "Vehiculos",
  home: "Hogar",
  gardening: "Jardineria",
  music: "Musica",
  photography: "Fotografia",
  camping: "Camping",
  clothing: "Ropa",
  other: "Otros",
};

const CATEGORY_ORDER = [
  "electronics",
  "tools",
  "sports",
  "vehicles",
  "home",
  "gardening",
  "music",
  "photography",
  "camping",
  "clothing",
  "other",
];

const CONDITION_LABELS: Record<string, string> = {
  new: "Nuevo",
  like_new: "Excelente",
  good: "Muy bueno",
  fair: "Bueno",
  poor: "Aceptable",
};

const CONDITION_ORDER = ["new", "like_new", "good", "fair", "poor"];

const SORT_OPTIONS = [
  { value: "recent", label: "Mas recientes" },
  { value: "price_asc", label: "Precio: menor a mayor" },
  { value: "price_desc", label: "Precio: mayor a menor" },
  { value: "oldest", label: "Mas antiguos" },
];

interface SearchState {
  items: SearchItemResponse[];
  total: number;
  categoryCounts: Record<string, number>;
  cityCounts: Record<string, number>;
  conditionCounts: Record<string, number>;
  loading: boolean;
  error: string;
}

function humanizeCategory(value: string) {
  return CATEGORY_LABELS[value] ?? value.replaceAll("_", " ");
}

function humanizeCondition(value: string) {
  return CONDITION_LABELS[value] ?? value.replaceAll("_", " ");
}

function seededRating(id: string) {
  const seed = Array.from(id).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return {
    rating: (4.5 + (seed % 6) / 10).toFixed(1),
    reviews: 7 + (seed % 42),
  };
}

function getPageWindow(page: number, totalPages: number) {
  const pages = new Set<number>([1, page, page + 1, page + 2, totalPages].filter((p) => p >= 1 && p <= totalPages));
  return Array.from(pages).sort((a, b) => a - b);
}

interface FilterSectionProps {
  title: string;
  children: ReactNode;
}

function FilterSection({ title, children }: FilterSectionProps) {
  return (
    <section className="border-border-main border-b px-5 py-5">
      <h3 className="mb-3 text-[15px] font-bold">{title}</h3>
      {children}
    </section>
  );
}

interface ProductCardProps {
  item: SearchItemResponse;
  onOpen: () => void;
}

function ProductCard({ item, onOpen }: ProductCardProps) {
  const { rating, reviews } = seededRating(item.item_id);
  const isReserved = item.item_status === "rented";
  const isAvailable = item.is_available && !isReserved;

  return (
    <article className="border-border-main bg-page overflow-hidden rounded-xl border">
      <div className="bg-primary-light relative h-[168px] overflow-hidden">
        {item.primary_image_url ? (
          <img
            src={item.primary_image_url}
            alt={item.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-[linear-gradient(135deg,#e1f5ee_0%,#d7f1e9_55%,#dff6ed_100%)]" />
        )}

        <span
          className={`absolute top-3 left-4 rounded-full px-3 py-1 text-[11px] font-medium ${
            isAvailable ? "bg-[#e8faf3] text-primary" : "bg-[#fff0c4] text-[#9b7411]"
          }`}
        >
          {isAvailable ? "Disponible" : "No disponible"}
        </span>

        <button
          type="button"
          className="absolute top-3 right-3 flex size-8 items-center justify-center rounded-full bg-white p-0 text-subtle hover:text-heart-active"
          aria-label="Guardar favorito"
          onClick={(event) => event.stopPropagation()}
        >
          <Heart size={17} />
        </button>
      </div>

      <div className="p-4">
        <button
          type="button"
          className="mb-5 block h-auto w-full p-0 text-left"
          onClick={onOpen}
        >
          <h2 className="line-clamp-2 min-h-[38px] text-[15px] leading-snug font-medium text-ink">{item.title}</h2>
        </button>

        <div className="mb-6 flex items-center justify-between">
          <p className="text-card-loc text-subtle">{item.city || "Sin ubicacion"}</p>
          <p className="flex items-center gap-1 text-card-loc text-rating">
            <Star
              size={13}
              fill="currentColor"
            />
            {rating} ({reviews})
          </p>
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-[17px] font-bold text-primary">{Math.round(item.price_per_day)} EUR/dia</p>
          <button
            type="button"
            className="btn-primary btn--sm min-w-[92px]"
            disabled={!isAvailable}
            onClick={onOpen}
          >
            {isAvailable ? "Alquilar" : "No disponible"}
          </button>
        </div>
      </div>
    </article>
  );
}

function SearchSkeleton() {
  return (
    <>
      {Array.from({ length: 12 }, (_, index) => (
        <div
          key={index}
          className="border-border-main bg-page animate-pulse overflow-hidden rounded-xl border"
        >
          <div className="bg-primary-light h-[168px]" />
          <div className="space-y-5 p-4">
            <div className="bg-border-main h-4 w-4/5 rounded" />
            <div className="bg-border-main h-3 w-1/2 rounded" />
            <div className="flex justify-between">
              <div className="bg-border-main h-5 w-24 rounded" />
              <div className="bg-border-main h-8 w-20 rounded" />
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

/**
 * Search results page with server-backed filters and pagination.
 */
function Search() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [draftQuery, setDraftQuery] = useState(searchParams.get("q") ?? "");
  const [state, setState] = useState<SearchState>({
    items: [],
    total: 0,
    categoryCounts: {},
    cityCounts: {},
    conditionCounts: {},
    loading: true,
    error: "",
  });

  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const query = searchParams.get("q") ?? "";
  const category = searchParams.get("category") ?? "";
  const city = searchParams.get("city") ?? "";
  const condition = searchParams.get("condition") ?? "";
  const dateFrom = searchParams.get("date_from") ?? "";
  const dateTo = searchParams.get("date_to") ?? "";
  const sort = searchParams.get("sort") ?? "recent";
  const minPrice = searchParams.get("min_price") ?? "";
  const maxPrice = searchParams.get("max_price") ?? "";

  useEffect(() => {
    setDraftQuery(query);
  }, [query]);

  useEffect(() => {
    if (draftQuery.trim() === query) return;

    const timeoutId = window.setTimeout(() => {
      updateParam("q", draftQuery.trim());
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [draftQuery, query]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams(searchParams);

    params.set("page", String(page > 0 ? page : 1));
    params.set("limit", String(PAGE_SIZE));

    setState((prev) => ({ ...prev, loading: true, error: "" }));

    fetch(`/api/items?${params.toString()}`, {
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (res) => {
        const json = (await res.json()) as ApiResponse<SearchItemsResponse>;
        if (!res.ok || !json.success || !json.data) {
          throw new Error(json.message ?? json.error ?? "Error al cargar los productos");
        }
        return json.data;
      })
      .then((data) => {
        setState({
          items: data.items,
          total: data.total,
          categoryCounts: data.category_counts,
          cityCounts: data.city_counts,
          conditionCounts: data.condition_counts,
          loading: false,
          error: "",
        });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setState({
          items: [],
          total: 0,
          categoryCounts: {},
          cityCounts: {},
          conditionCounts: {},
          loading: false,
          error: err instanceof Error ? err.message : "Error al cargar los productos",
        });
      });

    return () => controller.abort();
  }, [page, searchParams]);

  const totalPages = Math.max(1, Math.ceil(state.total / PAGE_SIZE));
  const pageWindow = useMemo(() => getPageWindow(page, totalPages), [page, totalPages]);

  const updateParam = (key: string, value: string, resetPage = true) => {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    if (resetPage) {
      next.set("page", "1");
    }
    setSearchParams(next);
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateParam("q", draftQuery.trim());
  };

  const clearFilters = () => {
    const next = new URLSearchParams();
    if (query) {
      next.set("q", query);
    }
    next.set("page", "1");
    setSearchParams(next);
  };

  const categoryOptions = useMemo(
    () =>
      Object.entries(state.categoryCounts)
        .map(([value, count]) => ({ value, label: humanizeCategory(value), count }))
        .sort((a, b) => {
          const aIndex = CATEGORY_ORDER.indexOf(a.value);
          const bIndex = CATEGORY_ORDER.indexOf(b.value);
          if (aIndex === -1 && bIndex === -1) return a.label.localeCompare(b.label);
          if (aIndex === -1) return 1;
          if (bIndex === -1) return -1;
          return aIndex - bIndex;
        }),
    [state.categoryCounts],
  );

  const cityOptions = useMemo(
    () =>
      Object.entries(state.cityCounts)
        .map(([value, count]) => ({ value, label: value, count }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    [state.cityCounts],
  );

  const conditionOptions = useMemo(
    () =>
      Object.entries(state.conditionCounts)
        .map(([value, count]) => ({ value, label: humanizeCondition(value), count }))
        .sort((a, b) => {
          const aIndex = CONDITION_ORDER.indexOf(a.value);
          const bIndex = CONDITION_ORDER.indexOf(b.value);
          if (aIndex === -1 && bIndex === -1) return a.label.localeCompare(b.label);
          if (aIndex === -1) return 1;
          if (bIndex === -1) return -1;
          return aIndex - bIndex;
        }),
    [state.conditionCounts],
  );

  const activeChips = [
    category && { label: humanizeCategory(category), key: "category" },
    city && { label: city, key: "city" },
    condition && { label: humanizeCondition(condition), key: "condition" },
    dateFrom && { label: `Desde ${dateFrom}`, key: "date_from" },
    dateTo && { label: `Hasta ${dateTo}`, key: "date_to" },
  ].filter(Boolean) as { label: string; key: string }[];
  const hasFilters = activeChips.length > 0 || minPrice !== "" || maxPrice !== "";
  const resultLabel = query ? `${state.total} resultados para "${query}"` : `${state.total} productos disponibles`;

  return (
    <div className="bg-surface min-h-screen">
      <div className="border-border-main bg-section-alt border-b">
        <div className="mx-auto grid max-w-[1360px] grid-cols-[minmax(0,1fr)_280px] items-center gap-7 px-10 py-4">
          <form
            className="border-primary focus-within:border-primary-dark flex h-12 items-center rounded-xl border-2 bg-white px-4 shadow-[0_1px_0_rgba(15,110,86,0.04)] transition-colors"
            onSubmit={submitSearch}
          >
            <SearchIcon
              className="text-primary mr-3 shrink-0"
              size={18}
            />
            <input
              type="search"
              value={draftQuery}
              onChange={(event) => setDraftQuery(event.target.value)}
              placeholder="Buscar productos, categorias o marcas"
              className="h-full flex-1 border-0 bg-transparent px-0 text-[15px] outline-none focus:border-0"
              aria-label="Buscar productos"
            />
            <button
              type="submit"
              className="btn-primary h-8 rounded-lg px-4 text-card-sm"
            >
              Buscar
            </button>
          </form>

          <div className="flex flex-col items-start justify-center gap-1">
            <p className="text-card-sm text-subtle">{resultLabel}</p>
            <label className="mb-0 grid grid-cols-[auto_1fr] items-center gap-3 text-card-sm text-subtle">
              Ordenar:
              <select
                value={sort}
                onChange={(event) => updateParam("sort", event.target.value)}
                className="h-9 w-[160px] rounded-lg bg-white text-ink"
              >
                {SORT_OPTIONS.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>

      <div className="border-border-main bg-page border-b">
        <div className="mx-auto flex max-w-[1360px] items-center gap-5 px-10 py-3">
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              className="border-primary-border bg-primary-light text-primary h-7 rounded-full border px-3 text-card-loc"
              onClick={() => updateParam(chip.key, "")}
            >
              {chip.label}
              <X size={12} />
            </button>
          ))}
          {hasFilters && (
            <button
              type="button"
              className="h-7 px-0 text-card-loc text-report"
              onClick={clearFilters}
            >
              Limpiar filtros
            </button>
          )}
          {!hasFilters && <span className="h-7 text-card-loc text-subtle">Usa los filtros para acotar resultados</span>}
        </div>
      </div>

      <div className="mx-auto grid max-w-[1360px] grid-cols-[272px_minmax(0,1fr)]">
        <aside className="border-border-main bg-page border-r">
          <FilterSection title="Categoria">
            <div className="space-y-2">
              {categoryOptions.map((option) => (
                <label
                  key={option.value}
                  className="mb-0 flex items-center gap-2 text-body-color"
                >
                  <input
                    type="checkbox"
                    checked={category === option.value}
                    onChange={() => updateParam("category", category === option.value ? "" : option.value)}
                  />
                  {option.label} ({state.categoryCounts[option.value] ?? 0})
                </label>
              ))}
              {!state.loading && categoryOptions.length === 0 && (
                <p className="text-card-loc text-subtle">Sin categorias disponibles</p>
              )}
            </div>
          </FilterSection>

          <FilterSection title="Precio por dia">
            <div className="grid grid-cols-2 gap-3">
              <label className="mb-0 text-card-loc text-subtle">
                Min
                <input
                  type="number"
                  min="0"
                  value={minPrice}
                  placeholder="5"
                  onChange={(event) => updateParam("min_price", event.target.value)}
                  className="mt-1 h-9"
                />
              </label>
              <label className="mb-0 text-card-loc text-subtle">
                Max
                <input
                  type="number"
                  min="0"
                  value={maxPrice}
                  placeholder="50"
                  onChange={(event) => updateParam("max_price", event.target.value)}
                  className="mt-1 h-9"
                />
              </label>
            </div>
          </FilterSection>

          <FilterSection title="Ubicacion">
            <div className="space-y-2">
              {cityOptions.map((option) => (
                <label
                  key={option.value}
                  className="mb-0 flex items-center gap-2 text-body-color"
                >
                  <input
                    type="checkbox"
                    checked={city === option.value}
                    onChange={() => updateParam("city", city === option.value ? "" : option.value)}
                  />
                  {option.label} ({option.count})
                </label>
              ))}
              {!state.loading && cityOptions.length === 0 && (
                <p className="text-card-loc text-subtle">Sin ubicaciones disponibles</p>
              )}
            </div>
          </FilterSection>

          <FilterSection title="Disponibilidad">
            <div className="grid grid-cols-2 gap-4">
              <label className="mb-0 text-card-loc text-subtle">
                Desde
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(event) => updateParam("date_from", event.target.value)}
                  className="mt-1 h-9"
                />
              </label>
              <label className="mb-0 text-card-loc text-subtle">
                Hasta
                <input
                  type="date"
                  value={dateTo}
                  onChange={(event) => updateParam("date_to", event.target.value)}
                  className="mt-1 h-9"
                />
              </label>
            </div>
          </FilterSection>

          <FilterSection title="Estado">
            <div className="space-y-2">
              {conditionOptions.map((option) => (
                <label
                  key={option.value}
                  className="mb-0 flex items-center gap-2 text-body-color"
                >
                  <input
                    type="checkbox"
                    checked={condition === option.value}
                    onChange={() => updateParam("condition", condition === option.value ? "" : option.value)}
                  />
                  {option.label} ({option.count})
                </label>
              ))}
              {!state.loading && conditionOptions.length === 0 && (
                <p className="text-card-loc text-subtle">Sin estados disponibles</p>
              )}
            </div>
          </FilterSection>
        </aside>

        <main className="px-9 pt-5 pb-8">
          {state.error && (
            <div className="border-report bg-error-danger mb-5 rounded-lg border p-4 text-report">{state.error}</div>
          )}

          <div className="grid grid-cols-3 gap-x-5 gap-y-6">
            {state.loading ? (
              <SearchSkeleton />
            ) : (
              state.items.map((item) => (
                <ProductCard
                  key={item.item_id}
                  item={item}
                  onOpen={() => navigate(`/product/${item.item_id}`)}
                />
              ))
            )}
          </div>

          {!state.loading && state.items.length === 0 && !state.error && (
            <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
              <h2 className="text-section-hd font-bold">No hay productos con estos filtros</h2>
              <p className="text-body-color mt-2">Prueba con otra busqueda o limpia los filtros activos.</p>
            </div>
          )}

          {!state.loading && totalPages > 1 && (
            <div className="mt-24 flex items-center justify-center gap-2">
              <button
                type="button"
                className="btn-secondary btn--sm w-10 p-0"
                disabled={page <= 1}
                onClick={() => updateParam("page", String(page - 1), false)}
                aria-label="Pagina anterior"
              >
                <ChevronLeft size={16} />
              </button>
              {pageWindow.map((pageNumber, index) => (
                <span
                  key={pageNumber}
                  className="flex items-center gap-2"
                >
                  {index > 0 && pageNumber - pageWindow[index - 1] > 1 && (
                    <span className="border-border-input flex h-10 min-w-10 items-center justify-center rounded-lg border bg-white px-3 text-subtle">
                      ...
                    </span>
                  )}
                  <button
                    type="button"
                    className={`${pageNumber === page ? "btn-primary" : "btn-secondary"} btn--sm min-w-10 p-0`}
                    onClick={() => updateParam("page", String(pageNumber), false)}
                  >
                    {pageNumber}
                  </button>
                </span>
              ))}
              <button
                type="button"
                className="btn-secondary btn--sm w-10 p-0"
                disabled={page >= totalPages}
                onClick={() => updateParam("page", String(page + 1), false)}
                aria-label="Pagina siguiente"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export { Search };
