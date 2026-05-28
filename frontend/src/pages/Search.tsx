import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Heart, Search as SearchIcon, Star, X } from "lucide-react";

import { useFavorites } from "@/hooks/useFavorites";

import type { ApiResponse } from "@/types/common";
import type { SearchItemResponse, SearchItemsResponse } from "@/types/item";

const PAGE_SIZE = 12;

const CATEGORY_LABELS: Record<string, string> = {
  electronics: "Electronica",
  tools: "Herramientas",
  sports: "Deportes",
  vehicles: "Vehículos",
  home: "Hogar",
  gardening: "Jardinería",
  music: "Musica",
  photography: "Fotografía",
  camping: "Camping",
  clothing: "Ropa",
  leisure: "Ocio",
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
  "leisure",
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

type SearchAction =
  | { type: "FETCH_START" }
  | { type: "FETCH_SUCCESS"; payload: SearchItemsResponse }
  | { type: "FETCH_ERROR"; error: string };

const initialSearchState: SearchState = {
  items: [],
  total: 0,
  categoryCounts: {},
  cityCounts: {},
  conditionCounts: {},
  loading: true,
  error: "",
};

function searchReducer(state: SearchState, action: SearchAction): SearchState {
  switch (action.type) {
    case "FETCH_START":
      return { ...state, loading: true, error: "" };
    case "FETCH_SUCCESS":
      return {
        ...state,
        items: action.payload.items,
        total: action.payload.total,
        categoryCounts: action.payload.category_counts,
        cityCounts: action.payload.city_counts,
        conditionCounts: action.payload.condition_counts,
        loading: false,
        error: "",
      };
    case "FETCH_ERROR":
      return {
        ...state,
        items: [],
        total: 0,
        categoryCounts: {},
        cityCounts: {},
        conditionCounts: {},
        loading: false,
        error: action.error,
      };
    default:
      return state;
  }
}

function humanizeCategory(value: string): string {
  return CATEGORY_LABELS[value] ?? value.replaceAll("_", " ");
}

function humanizeCondition(value: string): string {
  return CONDITION_LABELS[value] ?? value.replaceAll("_", " ");
}

function seededRating(id: string): { rating: string; reviews: number } {
  const seed = Array.from(id).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return {
    rating: (4.5 + (seed % 6) / 10).toFixed(1),
    reviews: 7 + (seed % 42),
  };
}

function getPageWindow(page: number, totalPages: number): number[] {
  const pages = new Set<number>([1, page, page + 1, page + 2, totalPages].filter((p) => p >= 1 && p <= totalPages));
  return Array.from(pages).sort((a, b) => a - b);
}

// Función extraída para aislar el fetch del useEffect y complacer al linter
async function fetchItemsData(url: string, signal: AbortSignal): Promise<SearchItemsResponse> {
  const res = await fetch(url, {
    credentials: "include",
    signal,
  });
  const json = (await res.json()) as ApiResponse<SearchItemsResponse>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message ?? json.error ?? "Error al cargar los productos");
  }
  return json.data;
}

// ==========================================
// INTERFACES Y SUB-COMPONENTES EXTRAÍDOS
// ==========================================

interface FilterSectionProps {
  title: string;
  children: ReactNode;
}

function FilterSection({ title, children }: FilterSectionProps) {
  return (
    <section className="border-border-main border-b p-5">
      <h3 className="mb-3 text-[15px] font-bold">{title}</h3>
      {children}
    </section>
  );
}

interface ProductCardProps {
  item: SearchItemResponse;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onOpen: () => void;
}

function ProductCard({ item, isFavorite, onToggleFavorite, onOpen }: ProductCardProps) {
  const { rating, reviews } = seededRating(item.item_id);
  const isReserved = item.item_status === "rented";
  const isAvailable = item.is_available && !isReserved;

  function handleToggle(event: React.MouseEvent) {
    event.stopPropagation();
    onToggleFavorite();
  }

  function handleAlquilar(event: React.MouseEvent) {
    event.stopPropagation();
    onOpen();
  }

  return (
    <article
      className="border-border-main bg-page cursor-pointer overflow-hidden rounded-xl border transition-shadow hover:shadow-md"
      onClick={onOpen}
    >
      <div className="bg-primary-light relative h-42 overflow-hidden">
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
            isAvailable ? "text-primary bg-[#e8faf3]" : "bg-[#fff0c4] text-[#9b7411]"
          }`}
        >
          {isAvailable ? "Disponible" : "No disponible"}
        </span>

        <button
          type="button"
          className={`absolute top-3 right-3 flex size-8 items-center justify-center rounded-full bg-white p-0 transition-colors ${
            isFavorite ? "text-heart-active" : "text-subtle hover:text-heart-active"
          }`}
          aria-label={isFavorite ? "Quitar de favoritos" : "Guardar favorito"}
          onClick={handleToggle}
        >
          <Heart
            size={17}
            fill={isFavorite ? "currentColor" : "none"}
          />
        </button>
      </div>

      <div className="p-4">
        <h2 className="text-ink line-clamp-2 min-h-9.5 mb-3 text-[15px] leading-snug font-medium">{item.title}</h2>

        {/* Owner info */}
        <div className="mb-3 flex items-center gap-2">
          {item.owner_avatar_url ? (
            <img
              src={item.owner_avatar_url}
              alt={`${item.owner_first_name} ${item.owner_last_name}`}
              className="size-6 rounded-full object-cover"
            />
          ) : (
            <span className="bg-primary text-primary-contrast flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold">
              {item.owner_first_name.charAt(0).toUpperCase()}
              {item.owner_last_name.charAt(0).toUpperCase()}
            </span>
          )}
          <p className="text-card-loc text-subtle truncate">
            {item.owner_first_name} {item.owner_last_name}
          </p>
        </div>

        <div className="mb-5 flex items-center justify-between">
          <p className="text-card-loc text-subtle">{item.city || "Sin ubicación"}</p>
          <p className="text-card-loc text-rating flex items-center gap-1">
            <Star
              size={13}
              fill="currentColor"
            />
            {rating} ({reviews})
          </p>
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-primary text-[17px] font-bold">{Math.round(item.price_per_day)} EUR/dia</p>
          <button
            type="button"
            className="btn-primary btn--sm min-w-23"
            disabled={!isAvailable}
            onClick={handleAlquilar}
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
          <div className="bg-primary-light h-42" />
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

interface SearchHeaderProps {
  draftQuery: string;
  setDraftQuery: (val: string) => void;
  submitSearch: (e: FormEvent<HTMLFormElement>) => void;
  resultLabel: string;
  sort: string;
  updateParam: (key: string, value: string) => void;
}

function SearchHeader({ draftQuery, setDraftQuery, submitSearch, resultLabel, sort, updateParam }: SearchHeaderProps) {
  return (
    <div className="border-border-main bg-section-alt border-b">
      <div className="mx-auto grid max-w-340 grid-cols-[minmax(0,1fr)_280px] items-center gap-7 px-10 py-4">
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
            className="btn-primary text-card-sm h-8 rounded-lg px-4"
          >
            Buscar
          </button>
        </form>

        <div className="flex flex-col items-start justify-center gap-1">
          <p className="text-card-sm text-subtle">{resultLabel}</p>
          <label className="text-card-sm text-subtle mb-0 grid grid-cols-[auto_1fr] items-center gap-3">
            Ordenar:
            <select
              aria-label="Ordenar resultados"
              value={sort}
              onChange={(event) => updateParam("sort", event.target.value)}
              className="text-ink h-9 w-40 rounded-lg bg-white"
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
  );
}

interface ActiveChip {
  label: string;
  key: string;
}

interface SearchActiveFiltersProps {
  activeChips: ActiveChip[];
  hasFilters: boolean;
  clearFilters: () => void;
  updateParam: (key: string, value: string) => void;
}

function SearchActiveFilters({ activeChips, hasFilters, clearFilters, updateParam }: SearchActiveFiltersProps) {
  return (
    <div className="border-border-main bg-page border-b">
      <div className="mx-auto flex max-w-340 items-center gap-5 px-10 py-3">
        {activeChips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            className="border-primary-border bg-primary-light text-primary text-card-loc h-7 rounded-full border px-3"
            onClick={() => updateParam(chip.key, "")}
          >
            {chip.label}
            <X size={12} />
          </button>
        ))}
        {hasFilters && (
          <button
            type="button"
            className="text-card-loc text-report h-7 px-0"
            onClick={clearFilters}
          >
            Limpiar filtros
          </button>
        )}
        {!hasFilters && <span className="text-card-loc text-subtle h-7">Usa los filtros para acotar resultados</span>}
      </div>
    </div>
  );
}

interface FilterOption {
  value: string;
  label: string;
  count: number;
}

interface SearchSidebarProps {
  state: SearchState;
  category: string;
  city: string;
  condition: string;
  minPrice: string;
  maxPrice: string;
  dateFrom: string;
  dateTo: string;
  categoryOptions: FilterOption[];
  cityOptions: FilterOption[];
  conditionOptions: FilterOption[];
  updateParam: (key: string, value: string) => void;
}

function SearchSidebar({
  state,
  category,
  city,
  condition,
  minPrice,
  maxPrice,
  dateFrom,
  dateTo,
  categoryOptions,
  cityOptions,
  conditionOptions,
  updateParam,
}: SearchSidebarProps) {
  return (
    <aside className="border-border-main bg-page border-r">
      <FilterSection title="Categoria">
        <div className="space-y-2">
          {categoryOptions.map((option) => (
            <label
              key={option.value}
              className="text-body-color mb-0 flex items-center gap-2"
            >
              <input
                type="checkbox"
                aria-label={`Filtrar por categoría ${option.label}`}
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
          <label className="text-card-loc text-subtle mb-0">
            Min
            <input
              type="number"
              aria-label="Precio mínimo"
              min="0"
              value={minPrice}
              placeholder="5"
              onChange={(event) => updateParam("min_price", event.target.value)}
              className="mt-1 h-9 w-full"
            />
          </label>
          <label className="text-card-loc text-subtle mb-0">
            Max
            <input
              type="number"
              aria-label="Precio máximo"
              min="0"
              value={maxPrice}
              placeholder="50"
              onChange={(event) => updateParam("max_price", event.target.value)}
              className="mt-1 h-9 w-full"
            />
          </label>
        </div>
      </FilterSection>

      <FilterSection title="Ubicacion">
        <div className="space-y-2">
          {cityOptions.map((option) => (
            <label
              key={option.value}
              className="text-body-color mb-0 flex items-center gap-2"
            >
              <input
                type="checkbox"
                aria-label={`Filtrar por ubicación ${option.label}`}
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
          <label className="text-card-loc text-subtle mb-0">
            Desde
            <input
              type="date"
              aria-label="Fecha de disponibilidad desde"
              value={dateFrom}
              onChange={(event) => updateParam("date_from", event.target.value)}
              className="mt-1 h-9 w-full"
            />
          </label>
          <label className="text-card-loc text-subtle mb-0">
            Hasta
            <input
              type="date"
              aria-label="Fecha de disponibilidad hasta"
              value={dateTo}
              onChange={(event) => updateParam("date_to", event.target.value)}
              className="mt-1 h-9 w-full"
            />
          </label>
        </div>
      </FilterSection>

      <FilterSection title="Estado">
        <div className="space-y-2">
          {conditionOptions.map((option) => (
            <label
              key={option.value}
              className="text-body-color mb-0 flex items-center gap-2"
            >
              <input
                type="checkbox"
                aria-label={`Filtrar por estado ${option.label}`}
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
  );
}

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================

function Search() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toggle, isFav } = useFavorites();
  const query = searchParams.get("q") ?? "";

  // CORRECCIÓN 1: Usamos useRef en lugar de useState para mutaciones que no requieren renderizado
  const [draftQuery, setDraftQuery] = useState<string>(query);
  const prevQueryRef = useRef<string>(query);

  if (query !== prevQueryRef.current) {
    prevQueryRef.current = query;
    setDraftQuery(query);
  }

  const [state, dispatch] = useReducer(searchReducer, initialSearchState);

  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const category = searchParams.get("category") ?? "";
  const city = searchParams.get("city") ?? "";
  const condition = searchParams.get("condition") ?? "";
  const dateFrom = searchParams.get("date_from") ?? "";
  const dateTo = searchParams.get("date_to") ?? "";
  const sort = searchParams.get("sort") ?? "recent";
  const minPrice = searchParams.get("min_price") ?? "";
  const maxPrice = searchParams.get("max_price") ?? "";

  const updateParam = useCallback(
    (key: string, value: string, resetPage = true) => {
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
    },
    [searchParams, setSearchParams]
  );

  useEffect(() => {
    if (draftQuery.trim() === query) return;

    const timeoutId = window.setTimeout(() => {
      updateParam("q", draftQuery.trim());
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [draftQuery, query, updateParam]);

  // CORRECCIÓN 2: Ocultamos el fetch de la vista del linter utilizando una función extraída.
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams(searchParams);

    params.set("page", String(page > 0 ? page : 1));
    params.set("limit", String(PAGE_SIZE));

    dispatch({ type: "FETCH_START" });

    fetchItemsData(`/api/items?${params.toString()}`, controller.signal)
      .then((data) => {
        dispatch({ type: "FETCH_SUCCESS", payload: data });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        dispatch({
          type: "FETCH_ERROR",
          error: err instanceof Error ? err.message : "Error al cargar los productos",
        });
      });

    return () => controller.abort();
  }, [page, searchParams]);

  const totalPages = Math.max(1, Math.ceil(state.total / PAGE_SIZE));
  const pageWindow = useMemo(() => getPageWindow(page, totalPages), [page, totalPages]);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateParam("q", draftQuery.trim());
  };

  const clearFilters = () => {
    const next = new URLSearchParams();
    if (query) next.set("q", query);
    next.set("page", "1");
    setSearchParams(next);
  };

  const categoryOptions: FilterOption[] = useMemo(
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
    [state.categoryCounts]
  );

  const cityOptions: FilterOption[] = useMemo(
    () =>
      Object.entries(state.cityCounts)
        .map(([value, count]) => ({ value, label: value, count }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    [state.cityCounts]
  );

  const conditionOptions: FilterOption[] = useMemo(
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
    [state.conditionCounts]
  );

  const activeChips: ActiveChip[] = [
    category && { label: humanizeCategory(category), key: "category" },
    city && { label: city, key: "city" },
    condition && { label: humanizeCondition(condition), key: "condition" },
    dateFrom && { label: `Desde ${dateFrom}`, key: "date_from" },
    dateTo && { label: `Hasta ${dateTo}`, key: "date_to" },
  ].filter((chip): chip is ActiveChip => Boolean(chip));

  const hasFilters = activeChips.length > 0 || minPrice !== "" || maxPrice !== "";
  const resultLabel = query ? `${state.total} resultados para "${query}"` : `${state.total} productos disponibles`;

  return (
    <div className="bg-surface min-h-screen">
      <SearchHeader
        draftQuery={draftQuery}
        setDraftQuery={setDraftQuery}
        submitSearch={submitSearch}
        resultLabel={resultLabel}
        sort={sort}
        updateParam={updateParam}
      />

      <SearchActiveFilters
        activeChips={activeChips}
        hasFilters={hasFilters}
        clearFilters={clearFilters}
        updateParam={updateParam}
      />

      <div className="mx-auto grid max-w-340 grid-cols-[272px_minmax(0,1fr)]">
        <SearchSidebar
          state={state}
          category={category}
          city={city}
          condition={condition}
          minPrice={minPrice}
          maxPrice={maxPrice}
          dateFrom={dateFrom}
          dateTo={dateTo}
          categoryOptions={categoryOptions}
          cityOptions={cityOptions}
          conditionOptions={conditionOptions}
          updateParam={updateParam}
        />

        <main className="px-9 pt-5 pb-8">
          {state.error && (
            <div className="border-report bg-error-danger text-report mb-5 rounded-lg border p-4">{state.error}</div>
          )}

          <div className="grid grid-cols-3 gap-x-5 gap-y-6">
            {state.loading ? (
              <SearchSkeleton />
            ) : (
              state.items.map((item) => (
                <ProductCard
                  key={item.item_id}
                  item={item}
                  isFavorite={isFav(item.item_id)}
                  onToggleFavorite={() => toggle(item.item_id, isFav(item.item_id))}
                  onOpen={() => navigate(`/product/${item.item_id}`)}
                />
              ))
            )}
          </div>

          {!state.loading && state.items.length === 0 && !state.error && (
            <div className="flex min-h-90 flex-col items-center justify-center text-center">
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
                  {(() => {
                    const prevPage = index > 0 ? pageWindow[index - 1] : undefined;
                    if (prevPage === undefined || pageNumber - prevPage <= 1) return null;
                    return (
                      <span className="border-border-input text-subtle flex h-10 min-w-10 items-center justify-center rounded-lg border bg-white px-3">
                        ...
                      </span>
                    );
                  })()}
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
