import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { BookingCard } from "@/components/product/detail/BookingCard";
import { InsuranceCard } from "@/components/product/detail/InsuranceCard";
import { OwnerCard } from "@/components/product/detail/OwnerCard";
import { ProductCalendar } from "@/components/product/detail/ProductCalendar";
import { ProductImageGallery } from "@/components/product/detail/ProductImageGallery";
import { StarRating } from "@/components/product/detail/StarRating";
import type { ApiResponse } from "@/types/common";
import type { CustomerProfile } from "@/types/customer";
import type { ItemImageResponse, ItemResponse } from "@/types/item";

// ── Label maps ──────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  sports: "Deporte",
  electronics: "Electrónica",
  tools: "Herramientas",
  music: "Música",
  leisure: "Ocio",
  garden: "Jardín",
  home: "Hogar",
  clothing: "Ropa",
  vehicles: "Vehículos",
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

// ── Skeleton ─────────────────────────────────────────────────────────────────

function ProductSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="grid grid-cols-[1fr_392px] items-start gap-8">
        {/* Left */}
        <div className="flex flex-col gap-6">
          <div className="bg-primary-light h-[480px] rounded-lg" />
          <div className="flex gap-2">
            {Array.from({ length: 5 }, (_, i) => (
              <div
                key={i}
                className="bg-primary-light h-24 w-[154px] flex-shrink-0 rounded-lg"
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
          <div className="rounded-panel bg-primary-light h-[360px]" />
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

  const [item, setItem] = useState<ItemResponse | null>(null);
  const [images, setImages] = useState<ItemImageResponse[]>([]);
  const [owner, setOwner] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isFavorite, setIsFavorite] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });

  // Placeholder — a real implementation would fetch from /api/items/:id/bookings
  const occupiedDates = new Set<string>();

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    setError("");

    const load = async () => {
      try {
        const [itemData, imagesData] = await Promise.all([fetchItem(id), fetchImages(id)]);
        setItem(itemData);
        setImages(imagesData);

        // Owner profile is non-critical; ignore failures
        try {
          const ownerData = await fetchOwnerProfile(itemData.owner_id);
          setOwner(ownerData);
        } catch {
          // silently omit owner card if profile endpoint is unavailable
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al cargar el producto");
      } finally {
        setLoading(false);
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
    setDateRange((prev) => {
      if (!prev.start || prev.end !== null) {
        return { start: date, end: null };
      }
      if (date <= prev.start) {
        return { start: date, end: null };
      }
      return { start: prev.start, end: date };
    });
  };

  const rentalDays =
    dateRange.start && dateRange.end
      ? Math.round((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

  // ── Derived display values ────────────────────────────────────────────────

  const categoryLabel = item ? (CATEGORY_LABELS[item.category] ?? item.category) : "";

  // The backend does not currently expose a condition field in ItemResponse.
  // Access it defensively so the badge appears when the API is extended.
  const condition = item
    ? CONDITION_LABELS[(item as ItemResponse & { condition?: string }).condition ?? ""]
    : undefined;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="bg-surface min-h-screen py-8">
      <div className="px-layout-margin mx-auto max-w-[1280px]">
        {loading && <ProductSkeleton />}

        {!loading && (error || !item) && (
          <ProductError
            message={error || "Este producto no existe o ha sido eliminado."}
            onBack={() => void navigate(-1)}
          />
        )}

        {!loading && item && (
          <div className="grid grid-cols-[1fr_392px] items-start gap-8">
            {/* ════════════════════════════════════ Left column */}
            <div className="flex min-w-0 flex-col gap-6">
              {/* Image gallery */}
              <ProductImageGallery
                images={images}
                title={item.title}
                isAvailable={item.is_available}
                isFavorite={isFavorite}
                onToggleFavorite={() => setIsFavorite((f) => !f)}
              />

              {/* Title, badges and rating */}
              <div>
                <h2 className="text-ink mb-2 text-[22px] leading-tight font-bold">{item.title}</h2>

                <div className="mb-2 flex flex-wrap items-center gap-2">
                  {categoryLabel && <span className="product-estado-badge">{categoryLabel}</span>}
                  {condition && <span className="product-estado-badge">Estado: {condition}</span>}
                  {(item.brand ?? item.model) && (
                    <span className="product-estado-badge">{[item.brand, item.model].filter(Boolean).join(" ")}</span>
                  )}
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
              {item.description && (
                <>
                  <div>
                    <h3 className="heading-section mb-3">Descripcion</h3>
                    <p className="product-desc">{item.description}</p>
                  </div>
                  <hr className="divider-product" />
                </>
              )}

              {/* Availability calendar */}
              <div>
                <h3 className="heading-section mb-1">Disponibilidad</h3>
                <ProductCalendar
                  occupiedDates={occupiedDates}
                  selectedStart={dateRange.start}
                  selectedEnd={dateRange.end}
                  onDateSelect={handleDateSelect}
                />
              </div>
            </div>

            {/* ════════════════════════════════════ Right column */}
            <div className="top-8 flex flex-col gap-5">
              <BookingCard
                itemId={item.item_id}
                pricePerDay={item.price_per_day}
                rating={4.9}
                reviewCount={48}
                selectedStart={dateRange.start}
                selectedEnd={dateRange.end}
              />

              <InsuranceCard days={rentalDays} />

              {owner && (
                <OwnerCard
                  owner={owner}
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
