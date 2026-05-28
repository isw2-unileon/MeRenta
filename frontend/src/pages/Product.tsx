import { useEffect, useReducer } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { BookingCard } from "@/components/product/detail/BookingCard";
import { InsuranceCard } from "@/components/product/detail/InsuranceCard";
import { OwnerCard } from "@/components/product/detail/OwnerCard";
import { ProductCalendar } from "@/components/product/detail/ProductCalendar";
import { ProductImageGallery } from "@/components/product/detail/ProductImageGallery";
import { StarRating } from "@/components/product/detail/StarRating";
import { useAuth } from "@/hooks/useAuth";
import type { ApiResponse } from "@/types/common";
import type { CustomerProfile } from "@/types/customer";
import type { ItemImageResponse, ItemResponse } from "@/types/item";

// ── Label maps ──────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  sports: "Deportes",
  electronics: "Electronica",
  tools: "Herramientas",
  music: "Musica",
  photography: "Fotografía",
  camping: "Camping",
  home: "Hogar",
  clothing: "Ropa",
  vehicles: "Vehículos",
  gardening: "Jardinería",
  other: "Otros",
};

const CONDITION_LABELS: Record<string, string> = {
  new: "Nuevo",
  like_new: "Excelente",
  good: "Muy bueno",
  fair: "Bueno",
  poor: "Aceptable",
};

// ── API helpers ──────────────────────────────────────────────────────────────

async function fetchItem(id: string): Promise<ItemResponse> {
  const res = await fetch(`/api/items/${id}`, { credentials: "include" });
  const json = (await res.json()) as ApiResponse<ItemResponse>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.error ?? "Error al cargar el producto");
  }
  return json.data;
}

async function fetchImages(id: string): Promise<ItemImageResponse[]> {
  const res = await fetch(`/api/items/${id}/images`, { credentials: "include" });
  const json = (await res.json()) as ApiResponse<ItemImageResponse[]>;
  return json.data ?? [];
}

async function fetchOwnerProfile(ownerId: string): Promise<CustomerProfile> {
  const res = await fetch(`/api/customers/${ownerId}/profile`, {
    credentials: "include",
  });
  const json = (await res.json()) as ApiResponse<CustomerProfile>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error("Error al cargar el perfil del propietario");
  }
  return json.data;
}

// ── Date range state type ────────────────────────────────────────────────────

interface DateRange {
  start: Date | null;
  end: Date | null;
}

interface ProductState {
  item: ItemResponse | null;
  images: ItemImageResponse[];
  owner: CustomerProfile | null;
  loading: boolean;
  error: string;
  isFavorite: boolean;
  dateRange: DateRange;
}

type ProductAction =
  | { type: "set-loading"; value: boolean }
  | { type: "set-error"; value: string }
  | { type: "set-item"; value: ItemResponse | null }
  | { type: "set-images"; value: ItemImageResponse[] }
  | { type: "set-owner"; value: CustomerProfile | null }
  | { type: "toggle-favorite" }
  | { type: "set-date-range"; value: DateRange };

const INITIAL_STATE: ProductState = {
  item: null,
  images: [],
  owner: null,
  loading: true,
  error: "",
  isFavorite: false,
  dateRange: { start: null, end: null },
};

function productReducer(state: ProductState, action: ProductAction): ProductState {
  switch (action.type) {
    case "set-loading":
      return { ...state, loading: action.value };
    case "set-error":
      return { ...state, error: action.value };
    case "set-item":
      return { ...state, item: action.value };
    case "set-images":
      return { ...state, images: action.value };
    case "set-owner":
      return { ...state, owner: action.value };
    case "toggle-favorite":
      return { ...state, isFavorite: !state.isFavorite };
    case "set-date-range":
      return { ...state, dateRange: action.value };
    default:
      return state;
  }
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function ProductSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="grid grid-cols-[1fr_392px] items-start gap-8">
        {/* Left */}
        <div className="flex flex-col gap-6">
          <div className="bg-primary-light h-main-img rounded-lg" />
          <div className="flex gap-2">
            {Array.from({ length: 5 }, (_, i) => (
              <div
                key={i}
                className="bg-primary-light w-thumb-w h-24 shrink-0 rounded-lg"
              />
            ))}
          </div>
          <div className="flex flex-col gap-3">
            <div className="bg-primary-light h-7 w-3/4 rounded" />
            <div className="bg-primary-light h-4 w-1/3 rounded" />
          </div>
          <div className="bg-border-main h-px" />
          <div className="flex flex-col gap-2">
            <div className="bg-primary-light h-5 w-1/4 rounded" />
            <div className="bg-primary-light h-4 rounded" />
            <div className="bg-primary-light h-4 rounded" />
            <div className="bg-primary-light h-4 w-5/6 rounded" />
          </div>
        </div>

        {/* Right */}
        <div className="flex flex-col gap-5">
          <div className="rounded-panel bg-primary-light h-90" />
          <div className="rounded-panel bg-primary-light h-56" />
          <div className="rounded-panel bg-primary-light h-40" />
        </div>
      </div>
    </div>
  );
}

// ── Error state ───────────────────────────────────────────────────────────────

interface ProductErrorProps {
  message: string;
  onBack: () => void;
}

function ProductError({ message, onBack }: ProductErrorProps) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <p className="text-ink text-xl font-bold">Producto no encontrado</p>
      <p className="text-body-color">{message}</p>
      <button
        type="button"
        className="btn-secondary btn--md"
        onClick={onBack}
      >
        Volver
      </button>
    </div>
  );
}

// ── Main page component ───────────────────────────────────────────────────────

/**
 * Product detail page for a single listing.
 *
 * Layout: two-column grid (main content | sticky booking panel).
 * Left column:  image gallery → title/badges → description → availability calendar.
 * Right column: BookingCard (sticky) → InsuranceCard → OwnerCard.
 *
 * Data is fetched in parallel; the owner profile fetch is non-critical and
 * never blocks the page from rendering.
 * @returns The product detail page.
 */
function Product() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [state, dispatch] = useReducer(productReducer, INITIAL_STATE);

  // Placeholder — a real implementation would fetch from /api/items/:id/bookings
  const occupiedDates = new Set<string>();

  useEffect(() => {
    if (!id) return;

    dispatch({ type: "set-loading", value: true });
    dispatch({ type: "set-error", value: "" });

    const load = async () => {
      try {
        const [itemData, imagesData] = await Promise.all([fetchItem(id), fetchImages(id)]);
        dispatch({ type: "set-item", value: itemData });
        dispatch({ type: "set-images", value: imagesData });

        // Owner profile is non-critical; ignore failures
        try {
          const ownerData = await fetchOwnerProfile(itemData.owner_id);
          dispatch({ type: "set-owner", value: ownerData });
        } catch {
          // silently omit owner card if profile endpoint is unavailable
        }
      } catch (err) {
        dispatch({ type: "set-error", value: err instanceof Error ? err.message : "Error al cargar el producto" });
      } finally {
        dispatch({ type: "set-loading", value: false });
      }
    };

    void load();
  }, [id]);

  /**
   * Date selection state machine:
   * - No start → first click sets start.
   * - Start set, no end → click after start sets end; click before/on start resets.
   * - Both set → any click resets to a new start.
   */
  const handleDateSelect = (date: Date) => {
    dispatch({
      type: "set-date-range",
      value: (() => {
        if (!state.dateRange.start || state.dateRange.end !== null) {
          return { start: date, end: null };
        }
        if (date <= state.dateRange.start) {
          return { start: date, end: null };
        }
        return { start: state.dateRange.start, end: date };
      })(),
    });
  };

  const rentalDays =
    state.dateRange.start && state.dateRange.end
      ? Math.round((state.dateRange.end.getTime() - state.dateRange.start.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

  // ── Derived display values ────────────────────────────────────────────────

  const categoryLabel = state.item ? (CATEGORY_LABELS[state.item.category] ?? state.item.category) : "";

  const condition = state.item?.condition
    ? (CONDITION_LABELS[state.item.condition] ?? state.item.condition)
    : undefined;
  const isOwner = user?.customer_id === state.item?.owner_id;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="bg-surface min-h-screen py-8">
      <div className="px-layout-margin mx-auto max-w-[1280px]">
        {state.loading && <ProductSkeleton />}

        {!state.loading && (state.error || !state.item) && (
          <ProductError
            message={state.error || "Este producto no existe o ha sido eliminado."}
            onBack={() => void navigate(-1)}
          />
        )}

        {!state.loading && state.item && (
          <div className="grid grid-cols-[1fr_392px] items-start gap-8">
            {/* ════════════════════════════════════ Left column */}
            <div className="flex min-w-0 flex-col gap-6">
              {/* Image gallery */}
              <ProductImageGallery
                images={state.images}
                title={state.item.title}
                isAvailable={state.item.is_available}
                isFavorite={state.isFavorite}
                onToggleFavorite={() => dispatch({ type: "toggle-favorite" })}
              />

              {/* Title, badges and rating */}
              <div>
                <h2 className="text-ink mb-2 text-[22px] leading-tight font-bold">{state.item.title}</h2>

                <div className="mb-2 flex flex-wrap items-center gap-2">
                  {categoryLabel && <span className="product-estado-badge">{categoryLabel}</span>}
                  {condition && <span className="product-estado-badge">Estado: {condition}</span>}
                </div>

                {/* Rating row — uses placeholder values until reviews API exists */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1">
                    <StarRating rating={4.9} />
                    <p className="product-rating ml-1 font-medium">4.9</p>
                    <p className="product-location">(48 valoraciones)</p>
                  </div>
                  <p className="product-location">Madrid, Comunidad de Madrid</p>
                </div>
              </div>

              <hr className="divider-product" />

              {/* Description */}
              {state.item.description && (
                <>
                  <div>
                    <h3 className="heading-section mb-3">Descripcion</h3>
                    <p className="product-desc">{state.item.description}</p>
                  </div>
                  <hr className="divider-product" />
                </>
              )}

              {/* Usage rules */}
              {state.item.usage_rules && (
                <>
                  <div>
                    <h3 className="heading-section mb-3">Normas de uso</h3>
                    <p className="product-desc">{state.item.usage_rules}</p>
                  </div>
                  <hr className="divider-product" />
                </>
              )}

              {/* Availability calendar */}
              <div>
                <h3 className="heading-section mb-1">Disponibilidad</h3>
                <ProductCalendar
                  occupiedDates={occupiedDates}
                  selectedStart={state.dateRange.start}
                  selectedEnd={state.dateRange.end}
                  onDateSelect={handleDateSelect}
                />
              </div>
            </div>

            {/* ════════════════════════════════════ Right column */}
            <div className="top-8 flex flex-col gap-5">
              <BookingCard
                itemId={state.item.item_id}
                pricePerDay={state.item.price_per_day}
                rating={4.9}
                reviewCount={48}
                selectedStart={state.dateRange.start}
                selectedEnd={state.dateRange.end}
                minDays={state.item.min_days}
                maxDay={state.item.max_days}
                isOwner={isOwner}
              />

              <InsuranceCard days={rentalDays} />

              {state.owner && (
                <OwnerCard
                  owner={state.owner}
                  rating={4.8}
                  reviewCount={32}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export { Product };
