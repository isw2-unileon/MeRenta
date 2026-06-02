import { useEffect, useMemo, useReducer, useState, type FormEvent, type MouseEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Heart, Search as SearchIcon, Star } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { useFavorites } from "@/hooks/useFavorites";
import type { AddressResponse } from "@/types/address";
import type { ApiResponse } from "@/types/common";
import type { BookingDetailResponse, BookingListResponse } from "@/types/booking";
import type { FavoriteItemResponse, FavoritesResponse, SearchItemResponse, SearchItemsResponse } from "@/types/item";
import type { ReviewSummary } from "@/types/review";

const HOME_PAGE_SIZE = 8;
const FAVORITES_PREVIEW_SIZE = 4;
const HOME_SKELETON_IDS = ["home-skel-1", "home-skel-2", "home-skel-3", "home-skel-4"];

const CATEGORY_TONE_CLASSES = [
  "bg-cat-deporte",
  "bg-cat-fotografia",
  "bg-cat-herramientas",
  "bg-cat-aventura",
  "bg-cat-musica",
  "bg-cat-electronica",
  "bg-cat-orange-alt",
  "bg-cat-blue-alt",
  "bg-cat-purple-alt",
  "bg-primary-light",
];

const CATEGORY_LABELS: Record<string, string> = {
  sports: "Deportes",
  electronics: "Electrónica",
  tools: "Herramientas",
  music: "Música",
  photography: "Fotografia",
  gardening: "Jardineria",
  camping: "Camping",
  home: "Hogar",
  clothing: "Ropa",
  vehicles: "Vehículos",
  leisure: "Ocio",
  other: "Otros",
};

const CATEGORY_ORDER = [
  "sports",
  "electronics",
  "tools",
  "music",
  "photography",
  "gardening",
  "camping",
  "home",
  "clothing",
  "vehicles",
  "leisure",
  "other",
];

interface HomeState {
  products: SearchItemResponse[];
  favorites: FavoriteItemResponse[];
  addresses: AddressResponse[];
  categoryCounts: Record<string, number>;
  bookings: BookingDetailResponse[];
  loading: boolean;
  error: string;
}

interface NearbyState {
  items: SearchItemResponse[];
  loading: boolean;
  error: string;
}

type HomeAction =
  | { type: "fetch_start" }
  | {
      type: "fetch_success";
      products: SearchItemsResponse;
      favorites: FavoritesResponse;
      bookings: BookingListResponse;
      addresses: AddressResponse[];
    }
  | { type: "fetch_error"; error: string };

type NearbyAction =
  | { type: "fetch_start" }
  | { type: "fetch_success"; payload: SearchItemsResponse }
  | { type: "fetch_error"; error: string }
  | { type: "clear" };

const initialHomeState: HomeState = {
  products: [],
  favorites: [],
  addresses: [],
  categoryCounts: {},
  bookings: [],
  loading: true,
  error: "",
};

const initialNearbyState: NearbyState = {
  items: [],
  loading: false,
  error: "",
};

const emptyReviewSummary: ReviewSummary = {
  average_rating: 0,
  total: 0,
  distribution: {},
};

function homeReducer(state: HomeState, action: HomeAction): HomeState {
  switch (action.type) {
    case "fetch_start":
      return { ...state, loading: true, error: "" };
    case "fetch_success":
      return {
        products: action.products.items,
        favorites: action.favorites.items,
        addresses: action.addresses,
        categoryCounts: action.products.category_counts,
        bookings: action.bookings.items,
        loading: false,
        error: "",
      };
    case "fetch_error":
      return { ...initialHomeState, loading: false, error: action.error };
    default:
      return state;
  }
}

function nearbyReducer(state: NearbyState, action: NearbyAction): NearbyState {
  switch (action.type) {
    case "fetch_start":
      return { ...state, loading: true, error: "" };
    case "fetch_success":
      return { items: action.payload.items, loading: false, error: "" };
    case "fetch_error":
      return { items: [], loading: false, error: action.error };
    case "clear":
      return initialNearbyState;
    default:
      return state;
  }
}

function categoryLabel(category: string): string {
  if (CATEGORY_LABELS[category]) return CATEGORY_LABELS[category];

  return category
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (letter) => letter.toUpperCase());
}

function categoryTone(category: string): string {
  const seed = Array.from(category).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return CATEGORY_TONE_CLASSES[seed % CATEGORY_TONE_CLASSES.length] ?? "bg-primary-light";
}

function fmtDate(value: string): string {
  return new Date(value).toLocaleDateString("es-ES", { day: "numeric", month: "long" });
}

function uniqueAddressCities(addresses: AddressResponse[]): string[] {
  return Array.from(
    new Set(
      addresses.flatMap((address) => {
        const city = address.city.trim();
        return city ? [city] : [];
      })
    )
  ).sort((a, b) => a.localeCompare(b));
}

function buildItemsUrl(params: Record<string, string>): string {
  const searchParams = new URLSearchParams(params);
  return `/api/items?${searchParams.toString()}`;
}

async function readApiData<T>(res: Response, fallback: string): Promise<T> {
  const json = (await res.json()) as ApiResponse<T>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message ?? json.error ?? fallback);
  }
  return json.data;
}

async function fetchProducts(signal: AbortSignal): Promise<SearchItemsResponse> {
  const res = await fetch(buildItemsUrl({ page: "1", limit: String(HOME_PAGE_SIZE), sort: "recent" }), {
    credentials: "include",
    signal,
  });
  return readApiData<SearchItemsResponse>(res, "Error al cargar los productos");
}

async function fetchProductsByCity(city: string, signal: AbortSignal): Promise<SearchItemsResponse> {
  const res = await fetch(buildItemsUrl({ page: "1", limit: String(HOME_PAGE_SIZE), sort: "recent", city }), {
    credentials: "include",
    signal,
  });
  return readApiData<SearchItemsResponse>(res, "Error al cargar los productos cercanos");
}

async function fetchFavorites(signal: AbortSignal): Promise<FavoritesResponse> {
  const res = await fetch("/api/favorites", { credentials: "include", signal });
  return readApiData<FavoritesResponse>(res, "Error al cargar favoritos");
}

async function fetchAddresses(signal: AbortSignal): Promise<AddressResponse[]> {
  const res = await fetch("/api/addresses", { credentials: "include", signal });
  return readApiData<AddressResponse[]>(res, "Error al cargar direcciones");
}

async function fetchBookings(signal: AbortSignal): Promise<BookingListResponse> {
  const res = await fetch("/api/bookings/mine", { credentials: "include", signal });
  return readApiData<BookingListResponse>(res, "Error al cargar reservas");
}

async function fetchReviewSummary(ownerId: string, signal: AbortSignal): Promise<ReviewSummary> {
  const res = await fetch(`/api/reviews/summary/${ownerId}`, { credentials: "include", signal });
  return readApiData<ReviewSummary>(res, "Error al cargar valoraciones");
}

function scrollCategories(direction: "prev" | "next") {
  const container = document.getElementById("home-category-carousel");
  if (!container) return;

  container.scrollBy({
    left: direction === "next" ? 360 : -360,
    behavior: "smooth",
  });
}

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  to?: string;
  linkLabel?: string;
}

function SectionHeader({ title, subtitle, to, linkLabel = "Ver todos" }: SectionHeaderProps) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-section-hd text-ink font-semibold">{title}</h2>
        {subtitle && <p className="text-subtle text-[14px]">{subtitle}</p>}
      </div>
      {to && (
        <Link
          to={to}
          className="text-primary inline-flex items-center gap-1 text-[14px] font-medium"
        >
          {linkLabel}
          <ArrowRight size={14} />
        </Link>
      )}
    </div>
  );
}

interface HomeProductCardProps {
  item: SearchItemResponse | FavoriteItemResponse;
  isFavorite: boolean;
  reviewSummary?: ReviewSummary;
  onToggleFavorite: (id: string, currentlyFavorite: boolean) => void;
  badge?: string;
}

function HomeProductCard({ item, isFavorite, reviewSummary, onToggleFavorite, badge }: HomeProductCardProps) {
  const isAvailable = item.is_available && item.item_status !== "rented" && item.item_status !== "retired";
  const tone = categoryTone(item.category);
  const rating = reviewSummary && reviewSummary.total > 0 ? reviewSummary.average_rating.toFixed(1) : "";

  function handleFavorite(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    onToggleFavorite(item.item_id, isFavorite);
  }

  return (
    <Link
      to={`/product/${item.item_id}`}
      className="border-border-main bg-page block overflow-hidden rounded-xl border transition-shadow hover:shadow-md"
    >
      <div className={`relative h-38 overflow-hidden ${tone}`}>
        {item.primary_image_url ? (
          <img
            src={item.primary_image_url}
            alt={item.title}
            className="h-full w-full object-cover"
          />
        ) : null}
        {badge && (
          <span className="absolute top-3 left-3 rounded-full bg-gray-950 px-3 py-1 text-[11px] font-bold text-white">
            {badge}
          </span>
        )}
        <button
          type="button"
          className={`absolute top-3 right-3 flex size-8 items-center justify-center rounded-full bg-white p-0 shadow-sm ${
            isFavorite ? "text-heart-active" : "text-subtle hover:text-heart-active"
          }`}
          aria-label={isFavorite ? "Quitar de favoritos" : "Guardar favorito"}
          onClick={handleFavorite}
        >
          <Heart
            size={17}
            fill={isFavorite ? "currentColor" : "none"}
          />
        </button>
      </div>
      <div className="p-4">
        <h3 className="text-ink line-clamp-2 min-h-9.5 text-[15px] leading-snug font-medium">{item.title}</h3>
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-card-loc text-subtle truncate">{item.city || "Sin ubicacion"}</p>
          {rating && (
            <p className="text-card-loc text-rating flex shrink-0 items-center gap-1">
              <Star
                size={13}
                fill="currentColor"
              />
              {rating}
            </p>
          )}
        </div>
        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="text-primary text-[17px] font-bold">{Math.round(item.price_per_day)} EUR/dia</p>
          {!isAvailable && (
            <span className="rounded-lg bg-[#f3f4f6] px-3 py-2 text-[12px] font-medium text-[#9ca3af]">
              No disponible
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function ProductSkeletonGrid() {
  return (
    <>
      {HOME_SKELETON_IDS.map((id) => (
        <div
          key={id}
          className="border-border-main bg-page animate-pulse overflow-hidden rounded-xl border"
        >
          <div className="bg-primary-light h-38" />
          <div className="space-y-4 p-4">
            <div className="bg-border-main h-4 w-4/5 rounded" />
            <div className="bg-border-main h-3 w-1/2 rounded" />
            <div className="bg-border-main h-5 w-24 rounded" />
          </div>
        </div>
      ))}
    </>
  );
}

interface ProductSectionProps {
  title: string;
  subtitle: string;
  items: Array<SearchItemResponse | FavoriteItemResponse>;
  loading: boolean;
  to: string;
  emptyText: string;
  isFavorite: (id: string) => boolean;
  toggleFavorite: (id: string, currentlyFavorite: boolean) => void;
  reviewSummaries: Record<string, ReviewSummary>;
  badge?: string;
}

function ProductSection({
  title,
  subtitle,
  items,
  loading,
  to,
  emptyText,
  isFavorite,
  toggleFavorite,
  reviewSummaries,
  badge,
}: ProductSectionProps) {
  return (
    <section className="mt-11">
      <SectionHeader
        title={title}
        subtitle={subtitle}
        to={to}
      />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          <ProductSkeletonGrid />
        ) : (
          items.map((item) => (
            <HomeProductCard
              key={item.item_id}
              item={item}
              isFavorite={isFavorite(item.item_id)}
              reviewSummary={"owner_id" in item ? reviewSummaries[item.owner_id] : undefined}
              onToggleFavorite={toggleFavorite}
              badge={badge}
            />
          ))
        )}
      </div>
      {!loading && items.length === 0 && (
        <div className="profile-info-panel flex min-h-32 items-center justify-center p-6 text-center">
          <p className="text-subtle">{emptyText}</p>
        </div>
      )}
    </section>
  );
}

interface NearbyProductsSectionProps {
  cities: string[];
  selectedCity: string;
  state: NearbyState;
  isFavorite: (id: string) => boolean;
  toggleFavorite: (id: string, currentlyFavorite: boolean) => void;
  reviewSummaries: Record<string, ReviewSummary>;
  onCityChange: (city: string) => void;
}

function NearbyProductsSection({
  cities,
  selectedCity,
  state,
  isFavorite,
  toggleFavorite,
  reviewSummaries,
  onCityChange,
}: NearbyProductsSectionProps) {
  if (cities.length === 0) return null;

  const activeCity = selectedCity !== "" ? selectedCity : (cities[0] ?? "");
  const visibleItems = state.items.slice(0, HOME_PAGE_SIZE / 2);
  const searchUrl = activeCity ? `/search?city=${encodeURIComponent(activeCity)}` : undefined;

  return (
    <section className="mt-11">
      <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="grid grid-cols-[auto_minmax(160px,220px)] items-center gap-3">
            <h2 className="text-section-hd text-ink font-semibold whitespace-nowrap">Cerca de ti en</h2>
            <select
              value={activeCity}
              onChange={(event) => onCityChange(event.target.value)}
              className="border-border-main text-ink h-9 w-full rounded-lg border bg-white px-3 text-[14px]"
              aria-label="Ciudad"
            >
              {cities.map((city) => (
                <option
                  key={city}
                  value={city}
                >
                  {city}
                </option>
              ))}
            </select>
          </div>
          <p className="text-subtle text-[14px]">Elige una ciudad de tus direcciones guardadas</p>
        </div>

        <div className="flex h-9 items-center">
          {searchUrl && (
            <Link
              to={searchUrl}
              className="text-primary inline-flex items-center gap-1 text-[14px] font-medium"
            >
              Ver mas
              <ArrowRight size={14} />
            </Link>
          )}
        </div>
      </div>

      {activeCity && state.error && (
        <p className="border-report bg-error-danger text-report mb-4 rounded-lg border p-3 text-[13px]">
          {state.error}
        </p>
      )}

      {activeCity && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {state.loading ? (
            <ProductSkeletonGrid />
          ) : (
            visibleItems.map((item) => (
              <HomeProductCard
                key={item.item_id}
                item={item}
                isFavorite={isFavorite(item.item_id)}
                reviewSummary={reviewSummaries[item.owner_id]}
                onToggleFavorite={toggleFavorite}
              />
            ))
          )}
        </div>
      )}

      {activeCity && !state.loading && !state.error && visibleItems.length === 0 && (
        <div className="profile-info-panel flex min-h-32 items-center justify-center p-6 text-center">
          <p className="text-subtle">No hay productos disponibles en {activeCity}.</p>
        </div>
      )}
    </section>
  );
}

interface SearchHeroProps {
  firstName: string;
  categories: Array<{ value: string; label: string }>;
}

function SearchHero({ firstName, categories }: SearchHeroProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    void navigate(`/search${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <section className="bg-section-alt border-border-main border-b">
      <div className="mx-auto flex min-h-72 max-w-340 flex-col items-center justify-center px-6 py-10 md:px-10">
        <p className="text-subtle w-full max-w-190 text-left text-[15px]">Buenos dias, {firstName}</p>
        <h1 className="text-ink mt-2 w-full max-w-190 text-left text-4xl leading-tight font-bold">
          ¿Que necesitas hoy?
        </h1>
        <form
          className="border-border-main mt-6 flex h-14 w-full max-w-190 items-center rounded-xl border bg-white p-1.5 text-left shadow-[0_1px_0_rgba(15,110,86,0.04)]"
          onSubmit={submitSearch}
        >
          <SearchIcon
            className="text-subtle mx-3 shrink-0"
            size={18}
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Busca bicicletas, camaras, herramientas..."
            className="h-full min-w-0 flex-1 border-0 bg-transparent px-0 text-[15px] outline-none focus:border-0"
            aria-label="Buscar productos"
          />
          <button
            type="submit"
            className="btn-primary h-10 rounded-lg px-5 text-[13px]"
          >
            Buscar
          </button>
        </form>
        {categories.length > 0 && (
          <div className="mt-4 flex w-full max-w-190 flex-wrap justify-start gap-2">
            {categories.map((category) => (
              <button
                key={category.value}
                type="button"
                className="border-border-main text-body-color rounded-full border bg-white px-4 py-1.5 text-[12px] shadow-sm"
                onClick={() => void navigate(`/search?category=${encodeURIComponent(category.value)}`)}
              >
                {category.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

interface ActiveBookingBannerProps {
  booking?: BookingDetailResponse;
}

function ActiveBookingBanner({ booking }: ActiveBookingBannerProps) {
  if (!booking) return null;

  return (
    <section className="border-primary-border bg-primary-light mt-12 rounded-xl border p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <span className="bg-primary size-3 rounded-full" />
          <div>
            <p className="text-primary font-semibold">Tienes un alquiler en curso</p>
            <p className="text-primary text-[14px]">
              {booking.item_title} · Devolucion el {fmtDate(booking.end_date)}
            </p>
          </div>
        </div>
        <Link
          to="/bookings"
          className="btn-primary btn--sm self-start px-5 md:self-auto"
        >
          Ver detalles
          <ArrowRight size={14} />
        </Link>
      </div>
    </section>
  );
}

interface CategoryGridProps {
  categories: Array<{ value: string; label: string; count: number }>;
}

function CategoryGrid({ categories }: CategoryGridProps) {
  if (categories.length === 0) return null;

  return (
    <section className="mt-12">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-section-hd text-ink font-semibold">Explorar por categoria</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn-secondary btn--sm w-9 p-0"
            onClick={() => scrollCategories("prev")}
            aria-label="Categorias anteriores"
          >
            <ArrowLeft size={15} />
          </button>
          <button
            type="button"
            className="btn-secondary btn--sm w-9 p-0"
            onClick={() => scrollCategories("next")}
            aria-label="Categorias siguientes"
          >
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
      <div
        id="home-category-carousel"
        className="flex snap-x [scrollbar-width:none] gap-4 overflow-x-auto scroll-smooth pb-2 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {categories.map((category) => (
          <Link
            key={category.value}
            to={`/search?category=${encodeURIComponent(category.value)}`}
            className={`${categoryTone(category.value)} min-w-50 snap-start rounded-xl p-5 transition-transform hover:-translate-y-0.5`}
          >
            <p className="text-primary font-semibold">{category.label}</p>
            <p className="text-body-color mt-1 text-[13px]">
              {category.count} {category.count === 1 ? "producto" : "productos"}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}

/**
 * Entry page for authenticated users.
 * @returns Data-driven authenticated home page.
 */
function Home() {
  const { user } = useAuth();
  const { toggle, isFav } = useFavorites();
  const [state, dispatch] = useReducer(homeReducer, initialHomeState);
  const [nearbyState, dispatchNearby] = useReducer(nearbyReducer, initialNearbyState);
  const [selectedCity, setSelectedCity] = useState("");
  const [reviewSummaries, setReviewSummaries] = useState<Record<string, ReviewSummary>>({});

  useEffect(() => {
    const controller = new AbortController();
    dispatch({ type: "fetch_start" });

    Promise.all([
      fetchProducts(controller.signal),
      fetchFavorites(controller.signal),
      fetchBookings(controller.signal),
      fetchAddresses(controller.signal),
    ])
      .then(([products, favorites, bookings, addresses]) =>
        dispatch({ type: "fetch_success", products, favorites, bookings, addresses })
      )
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        dispatch({ type: "fetch_error", error: err instanceof Error ? err.message : "Error al cargar el inicio" });
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const productsWithOwners = [...state.products, ...nearbyState.items];
    if (productsWithOwners.length === 0) return;

    const controller = new AbortController();
    const ownerIds = Array.from(new Set(productsWithOwners.map((item) => item.owner_id)));
    const missingOwnerIds = ownerIds.filter((ownerId) => !reviewSummaries[ownerId]);

    if (missingOwnerIds.length === 0) return () => controller.abort();

    void Promise.all(
      missingOwnerIds.map(async (ownerId) => {
        try {
          return { ownerId, summary: await fetchReviewSummary(ownerId, controller.signal) };
        } catch {
          return { ownerId, summary: emptyReviewSummary };
        }
      })
    )
      .then((summaries) => {
        setReviewSummaries((prev) => {
          const next = { ...prev };
          summaries.forEach(({ ownerId, summary }) => {
            next[ownerId] = summary;
          });
          return next;
        });
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, [nearbyState.items, reviewSummaries, state.products]);

  const categoryPreview = useMemo(
    () =>
      Object.entries(state.categoryCounts)
        .map(([value, count]) => ({ value, label: categoryLabel(value), count }))
        .sort((a, b) => {
          const aIndex = CATEGORY_ORDER.indexOf(a.value);
          const bIndex = CATEGORY_ORDER.indexOf(b.value);

          if (aIndex === -1 && bIndex === -1) return b.count - a.count || a.label.localeCompare(b.label);
          if (aIndex === -1) return 1;
          if (bIndex === -1) return -1;
          return aIndex - bIndex;
        }),
    [state.categoryCounts]
  );

  const addressCities = useMemo(() => uniqueAddressCities(state.addresses), [state.addresses]);
  const activeNearbyCity = selectedCity !== "" ? selectedCity : (addressCities[0] ?? "");

  useEffect(() => {
    if (!activeNearbyCity) {
      dispatchNearby({ type: "clear" });
      return;
    }

    const controller = new AbortController();
    dispatchNearby({ type: "fetch_start" });

    fetchProductsByCity(activeNearbyCity, controller.signal)
      .then((data) => dispatchNearby({ type: "fetch_success", payload: data }))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        dispatchNearby({
          type: "fetch_error",
          error: err instanceof Error ? err.message : "Error al cargar productos cercanos",
        });
      });

    return () => controller.abort();
  }, [activeNearbyCity]);

  const favoriteItems = state.favorites.slice(0, FAVORITES_PREVIEW_SIZE);
  const recentItems = state.products.slice(0, HOME_PAGE_SIZE / 2);
  const activeBooking = state.bookings.find((booking) => booking.booking_status === "accepted");
  const firstName = user?.first_name ?? "usuario";

  return (
    <div className="bg-page min-h-screen">
      <SearchHero
        firstName={firstName}
        categories={categoryPreview.map(({ value, label }) => ({ value, label }))}
      />

      <main className="mx-auto max-w-340 px-6 py-9 md:px-10">
        {state.error && (
          <p className="border-report bg-error-danger text-report rounded-lg border p-4 text-[14px]">{state.error}</p>
        )}

        <ProductSection
          title="Tus favoritos"
          subtitle="Los productos que guardaste siguen disponibles"
          items={favoriteItems}
          loading={state.loading}
          to="/favs"
          emptyText="Aun no tienes favoritos guardados."
          isFavorite={isFav}
          toggleFavorite={toggle}
          reviewSummaries={reviewSummaries}
        />

        <NearbyProductsSection
          cities={addressCities}
          selectedCity={selectedCity}
          state={nearbyState}
          isFavorite={isFav}
          toggleFavorite={toggle}
          reviewSummaries={reviewSummaries}
          onCityChange={setSelectedCity}
        />

        <ActiveBookingBanner booking={activeBooking} />

        <CategoryGrid categories={categoryPreview} />

        <ProductSection
          title="Recien añadidos"
          subtitle="Ultimos productos añadidos"
          items={recentItems}
          loading={state.loading}
          to="/search?sort=recent"
          emptyText="Todavia no hay productos publicados."
          isFavorite={isFav}
          toggleFavorite={toggle}
          reviewSummaries={reviewSummaries}
          badge="NEW"
        />
      </main>
    </div>
  );
}

export { Home };
