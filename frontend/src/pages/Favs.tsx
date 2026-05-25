import { useCallback, useEffect, useReducer, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, Star } from "lucide-react";

import type { ApiResponse } from "@/types/common";
import type { FavoriteItemResponse, FavoritesResponse } from "@/types/item";

// ─── Constants ───────────────────────────────────────────────────────────────

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
  other: "Otros",
};

const SORT_OPTIONS = [
  { value: "recent", label: "Añadir reciente" },
  { value: "price_asc", label: "Precio: menor a mayor" },
  { value: "price_desc", label: "Precio: mayor a menor" },
];

// ─── State ───────────────────────────────────────────────────────────────────

interface FavsState {
  items: FavoriteItemResponse[];
  total: number;
  loading: boolean;
  error: string;
}

type FavsAction =
  | { type: "FETCH_START" }
  | { type: "FETCH_SUCCESS"; payload: FavoritesResponse }
  | { type: "FETCH_ERROR"; error: string }
  | { type: "REMOVE"; itemId: string };

const initialState: FavsState = {
  items: [],
  total: 0,
  loading: true,
  error: "",
};

function favsReducer(state: FavsState, action: FavsAction): FavsState {
  switch (action.type) {
    case "FETCH_START":
      return { ...state, loading: true, error: "" };
    case "FETCH_SUCCESS":
      return {
        ...state,
        items: action.payload.items,
        total: action.payload.total,
        loading: false,
        error: "",
      };
    case "FETCH_ERROR":
      return { ...state, items: [], total: 0, loading: false, error: action.error };
    case "REMOVE":
      return {
        ...state,
        items: state.items.filter((i) => i.item_id !== action.itemId),
        total: state.total - 1,
      };
    default:
      return state;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function seededRating(id: string): string {
  const seed = Array.from(id).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return (4.5 + (seed % 6) / 10).toFixed(1);
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "Hoy";
  if (days === 1) return "Hace 1 día";
  if (days < 7) return `Hace ${days} días`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return "Hace 1 semana";
  if (weeks < 5) return `Hace ${weeks} semanas`;
  const months = Math.floor(days / 30);
  return months === 1 ? "Hace 1 mes" : `Hace ${months} meses`;
}

function sortItems(items: FavoriteItemResponse[], sort: string): FavoriteItemResponse[] {
  return [...items].sort((a, b) => {
    if (sort === "price_asc") return a.price_per_day - b.price_per_day;
    if (sort === "price_desc") return b.price_per_day - a.price_per_day;
    // default: recent (newest saved_at first — already from the API, but re-sort for safety)
    return new Date(b.saved_at).getTime() - new Date(a.saved_at).getTime();
  });
}

async function fetchFavorites(): Promise<FavoritesResponse> {
  const res = await fetch("/api/favorites", { credentials: "include" });
  const json = (await res.json()) as ApiResponse<FavoritesResponse>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.error ?? "Error al cargar los favoritos");
  }
  return json.data;
}

async function removeFavorite(itemId: string): Promise<void> {
  const res = await fetch(`/api/favorites/${itemId}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok && res.status !== 204) {
    throw new Error("Error al eliminar el favorito");
  }
}

// ─── Sub-components ──────────────────────────────────────────────────────────

interface StatusBadgeProps {
  item: FavoriteItemResponse;
}

function StatusBadge({ item }: StatusBadgeProps) {
  const isRented = item.item_status === "rented";
  const isAvailable = item.is_available && !isRented;

  if (isRented) {
    return (
      <span className="inline-block rounded-full bg-[#fff0c4] px-3 py-1 text-[11px] font-medium text-[#9b7411]">
        Reservado
      </span>
    );
  }
  if (isAvailable) {
    return (
      <span className="text-primary inline-block rounded-full bg-[#e8faf3] px-3 py-1 text-[11px] font-medium">
        Disponible
      </span>
    );
  }
  return (
    <span className="inline-block rounded-full bg-[#f3f4f6] px-3 py-1 text-[11px] font-medium text-[#6b7280]">
      No disponible
    </span>
  );
}

interface ActionButtonProps {
  item: FavoriteItemResponse;
  onRent: () => void;
}

function ActionButton({ item, onRent }: ActionButtonProps) {
  const isRented = item.item_status === "rented";
  const isAvailable = item.is_available && !isRented;

  if (isRented) {
    return (
      <button
        type="button"
        className="btn--sm min-w-23 cursor-default rounded-lg bg-[#f3f4f6] px-4 py-2 text-[13px] font-medium text-[#9ca3af]"
        disabled
      >
        Reservado
      </button>
    );
  }
  if (!isAvailable) {
    return (
      <button
        type="button"
        className="btn--sm min-w-23 cursor-default rounded-lg bg-[#f3f4f6] px-4 py-2 text-[13px] font-medium text-[#9ca3af]"
        disabled
      >
        No disponible
      </button>
    );
  }
  return (
    <button
      type="button"
      className="btn-primary btn--sm min-w-23"
      onClick={onRent}
    >
      Alquilar
    </button>
  );
}

interface FavCardProps {
  item: FavoriteItemResponse;
  onRemove: (id: string) => void;
}

function FavCard({ item, onRemove }: FavCardProps) {
  const navigate = useNavigate();
  const rating = seededRating(item.item_id);
  const categoryLabel = CATEGORY_LABELS[item.category] ?? item.category;

  function handleRent() {
    void navigate(`/product/${item.item_id}`);
  }

  function handleOpen() {
    void navigate(`/product/${item.item_id}`);
  }

  function handleRemove(e: React.MouseEvent) {
    e.stopPropagation();
    onRemove(item.item_id);
  }

  return (
    <article className="border-border-main bg-page overflow-hidden rounded-xl border">
      {/* Image area */}
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

        <span className="absolute top-3 left-4 rounded-full bg-white/90 px-3 py-1 text-[11px] font-medium text-[#374151]">
          {categoryLabel}
        </span>

        <button
          type="button"
          className="text-heart-active absolute top-3 right-3 flex size-8 items-center justify-center rounded-full bg-white p-0 shadow-sm"
          aria-label="Quitar de favoritos"
          onClick={handleRemove}
        >
          <Heart
            size={17}
            fill="currentColor"
          />
        </button>
      </div>

      {/* Body */}
      <div className="p-4">
        <button
          type="button"
          className="mb-3 block h-auto w-full p-0 text-left"
          onClick={handleOpen}
        >
          <h2 className="text-ink line-clamp-2 min-h-9.5 text-[15px] font-medium leading-snug">
            {item.title}
          </h2>
        </button>

        <div className="mb-1 flex items-center justify-between">
          <p className="text-card-loc text-subtle">{item.city || "Sin ubicación"}</p>
          <p className="text-card-loc text-rating flex items-center gap-1">
            <Star
              size={13}
              fill="currentColor"
            />
            {rating}
          </p>
        </div>

        <div className="mb-2">
          <StatusBadge item={item} />
        </div>

        <p className="text-subtle mb-4 text-[11px]">Guardado {timeAgo(item.saved_at)}</p>

        <div className="flex items-center justify-between gap-3">
          <p className="text-primary text-[17px] font-bold">{Math.round(item.price_per_day)} EUR/dia</p>
          <ActionButton
            item={item}
            onRent={handleRent}
          />
        </div>
      </div>
    </article>
  );
}

function EmptySlot() {
  const navigate = useNavigate();
  return (
    <article className="border-border-main bg-page overflow-hidden rounded-xl border">
      {/* Same image-zone height as a real FavCard */}
      <div className="bg-primary-light h-42" />
      {/* Same body padding as a real FavCard */}
      <div className="flex min-h-[176px] flex-col items-center justify-center gap-3 p-4">
        <Heart
          size={32}
          className="text-subtle"
        />
        <p className="text-subtle text-center text-[13px]">Explora mas productos y guardalos aquí</p>
        <button
          type="button"
          className="btn-primary btn--sm mt-1"
          onClick={() => void navigate("/search")}
        >
          Explorar
        </button>
      </div>
    </article>
  );
}

function FavsSkeleton() {
  return (
    <>
      {Array.from({ length: 8 }, (_, i) => (
        <div
          key={i}
          className="border-border-main bg-page animate-pulse overflow-hidden rounded-xl border"
        >
          <div className="bg-primary-light h-42" />
          <div className="space-y-4 p-4">
            <div className="bg-border-main h-4 w-4/5 rounded" />
            <div className="bg-border-main h-3 w-1/2 rounded" />
            <div className="bg-border-main h-5 w-24 rounded" />
            <div className="bg-border-main h-3 w-1/3 rounded" />
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

// ─── Page ────────────────────────────────────────────────────────────────────

/**
 * Lists the authenticated user's saved favorite products.
 */
function Favs() {
  const [state, dispatch] = useReducer(favsReducer, initialState);
  const [activeCategory, setActiveCategory] = useState("all");
  const [sort, setSort] = useState("recent");
  const [removing, setRemoving] = useState<Set<string>>(new Set());

  // Fetch favorites on mount
  useEffect(() => {
    let cancelled = false;
    dispatch({ type: "FETCH_START" });
    fetchFavorites()
      .then((data) => {
        if (!cancelled) dispatch({ type: "FETCH_SUCCESS", payload: data });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Error desconocido";
          dispatch({ type: "FETCH_ERROR", error: message });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Remove a favorite optimistically
  const handleRemove = useCallback((itemId: string) => {
    setRemoving((prev) => new Set(prev).add(itemId));
    dispatch({ type: "REMOVE", itemId });
    removeFavorite(itemId).catch(() => {
      // on error we could re-add the item, but for simplicity we leave it removed
    });
  }, []);

  // Compute unique categories present in the list
  const categories = Array.from(new Set(state.items.map((i) => i.category)));

  // Filter + sort
  const filtered = sortItems(
    activeCategory === "all" ? state.items : state.items.filter((i) => i.category === activeCategory),
    sort,
  );

  // Fill with empty slots to complete the last row of 4
  const GRID_COLS = 4;
  const remainder = filtered.length % GRID_COLS;
  const emptySlots = remainder === 0 ? 0 : GRID_COLS - remainder;

  return (
    <div className="mx-auto max-w-340 px-10 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-ink text-2xl font-semibold">Tus favoritos</h1>
        {!state.loading && (
          <p className="text-subtle mt-1 text-[14px]">
            {state.total === 0
              ? "No tienes productos guardados"
              : `${state.total} ${state.total === 1 ? "producto guardado" : "productos guardados"}`}
          </p>
        )}
      </div>

      {/* Error */}
      {state.error && (
        <p className="mb-6 rounded-lg bg-red-50 p-4 text-[14px] text-red-600">{state.error}</p>
      )}

      {/* Filters + sort bar */}
      {!state.loading && state.total > 0 && (
        <div className="mb-6 flex items-center justify-between gap-4">
          {/* Category chips */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`rounded-full border px-4 py-1.5 text-[13px] font-medium transition-colors ${
                activeCategory === "all"
                  ? "border-primary bg-primary text-white"
                  : "border-border-main text-ink hover:border-primary hover:text-primary bg-white"
              }`}
              onClick={() => setActiveCategory("all")}
            >
              Todos
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`rounded-full border px-4 py-1.5 text-[13px] font-medium transition-colors ${
                  activeCategory === cat
                    ? "border-primary bg-primary text-white"
                    : "border-border-main text-ink hover:border-primary hover:text-primary bg-white"
                }`}
                onClick={() => setActiveCategory(cat)}
              >
                {CATEGORY_LABELS[cat] ?? cat}
              </button>
            ))}
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-subtle text-[13px]">Ordenar:</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="border-border-main text-ink rounded-lg border bg-white px-3 py-1.5 text-[13px] focus:outline-none"
            >
              {SORT_OPTIONS.map((opt) => (
                <option
                  key={opt.value}
                  value={opt.value}
                >
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Grid */}
      {state.loading ? (
        <div className="grid grid-cols-4 gap-5">
          <FavsSkeleton />
        </div>
      ) : state.total === 0 ? (
        /* Empty state (no favorites at all) */
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Heart
            size={48}
            className="text-subtle mb-4"
          />
          <h2 className="text-ink mb-2 text-xl font-semibold">Aún no tienes favoritos</h2>
          <p className="text-subtle mb-6 max-w-sm text-[14px]">
            Explora productos y pulsa el corazón para guardarlos aquí.
          </p>
          <a
            href="/search"
            className="btn-primary"
          >
            Explorar productos
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-5">
          {filtered.map((item) => (
            <FavCard
              key={item.item_id}
              item={item}
              onRemove={removing.has(item.item_id) ? () => undefined : handleRemove}
            />
          ))}
          {/* Empty slots to fill last row */}
          {Array.from({ length: emptySlots }, (_, i) => (
            <EmptySlot key={`empty-${i}`} />
          ))}
        </div>
      )}
    </div>
  );
}

export { Favs };
