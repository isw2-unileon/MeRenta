import { useCallback, useEffect, useReducer, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Heart, Star } from "lucide-react";

import type { ApiResponse } from "@/types/common";
import type { FavoriteItemResponse, FavoritesResponse } from "@/types/item";
import * as React from "react";

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

const SORT_OPTIONS = [
  { value: "recent", label: "Añadir reciente" },
  { value: "price_asc", label: "Precio: menor a mayor" },
  { value: "price_desc", label: "Precio: mayor a menor" },
];
const FAVS_SKELETON_IDS = [
  "fav-skel-1",
  "fav-skel-2",
  "fav-skel-3",
  "fav-skel-4",
  "fav-skel-5",
  "fav-skel-6",
  "fav-skel-7",
  "fav-skel-8",
];

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
  interface Sortable {
    toSorted(compareFn: (a: FavoriteItemResponse, b: FavoriteItemResponse) => number): FavoriteItemResponse[];
  }

  return (items as unknown as Sortable).toSorted((a, b) => {
    if (sort === "price_asc") return a.price_per_day - b.price_per_day;
    if (sort === "price_desc") return b.price_per_day - a.price_per_day;
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
  onRent: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

function ActionButton({ item, onRent }: ActionButtonProps) {
  const isRented = item.item_status === "rented";
  const isAvailable = item.is_available && !isRented;

  if (isRented) {
    return (
      <button
        type="button"
        className="btn--sm relative z-20 min-w-23 cursor-default rounded-lg bg-[#f3f4f6] px-4 py-2 text-[13px] font-medium text-[#9ca3af]"
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
        className="btn--sm relative z-20 min-w-23 cursor-default rounded-lg bg-[#f3f4f6] px-4 py-2 text-[13px] font-medium text-[#9ca3af]"
        disabled
      >
        No disponible
      </button>
    );
  }
  return (
    <button
      type="button"
      className="btn-primary btn--sm relative z-20 min-w-23"
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

  function handleRent(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    void navigate(`/product/${item.item_id}`);
  }

  function handleRemove(e: React.MouseEvent) {
    e.stopPropagation();
    onRemove(item.item_id);
  }

  return (
    <article
      className="border-border-main bg-page relative overflow-hidden rounded-xl border transition-shadow hover:shadow-md"
    >
      <Link
        to={`/product/${item.item_id}`}
        className="absolute inset-0 z-10 rounded-xl"
        aria-label={`Abrir ${item.title}`}
      />
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

        <div className="absolute top-3 right-13 left-4 flex items-center gap-2">
          <span className="product-estado-badge">
            {categoryLabel}
          </span>
          <StatusBadge item={item} />
        </div>

        <button
          type="button"
          className="text-heart-active absolute top-3 right-3 z-20 flex size-8 items-center justify-center rounded-full bg-white p-0 shadow-sm"
          aria-label="Quitar de favoritos"
          onClick={handleRemove}
        >
          <Heart
            size={17}
            fill="currentColor"
          />
        </button>
      </div>

      <div className="p-4">
        <h2 className="text-ink mb-3 line-clamp-2 min-h-9.5 text-[15px] leading-snug font-medium">{item.title}</h2>

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
      <div className="bg-primary-light h-42" />
      <div className="flex min-h-44 flex-col items-center justify-center gap-3 p-4">
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
      {FAVS_SKELETON_IDS.map((id) => (
        <div
          key={id}
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

/**
 * Lists the authenticated user's saved favorite products.
 */
function Favs() {
  const [state, dispatch] = useReducer(favsReducer, initialState);
  const [activeCategory, setActiveCategory] = useState("all");
  const [sort, setSort] = useState("recent");
  const [removing, setRemoving] = useState<Set<string>>(new Set());

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

  const handleRemove = useCallback((itemId: string) => {
    setRemoving((prev) => new Set(prev).add(itemId));
    dispatch({ type: "REMOVE", itemId });
    removeFavorite(itemId).catch(() => {});
  }, []);

  const categories = Array.from(new Set(state.items.map((i) => i.category)));

  const filtered = sortItems(
    activeCategory === "all" ? state.items : state.items.filter((i) => i.category === activeCategory),
    sort
  );

  const GRID_COLS = 4;
  const remainder = filtered.length % GRID_COLS;
  const emptySlots = remainder === 0 ? 0 : GRID_COLS - remainder;
  const emptySlotKeys = Array.from({ length: emptySlots }, (_, index) => `empty-slot-${filtered.length + index}`);

  return (
    <div className="mx-auto max-w-340 px-10 py-8">
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

      {state.error && <p className="mb-6 rounded-lg bg-red-50 p-4 text-[14px] text-red-600">{state.error}</p>}

      {!state.loading && state.total > 0 && (
        <div className="mb-6 flex items-center justify-between gap-4">
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

          <div className="flex shrink-0 items-center gap-2">
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

      {state.loading ? (
        <div className="grid grid-cols-4 gap-5">
          <FavsSkeleton />
        </div>
      ) : state.total === 0 ? (
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
          {emptySlotKeys.map((key) => (
            <EmptySlot key={key} />
          ))}
        </div>
      )}
    </div>
  );
}

export { Favs };
