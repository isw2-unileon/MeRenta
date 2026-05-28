import { useEffect, useMemo, useReducer } from "react";
import { ArrowRight, Check, Circle, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { StarRating } from "@/components/product/detail/StarRating";
import { useAuth } from "@/hooks/useAuth";
import type { ApiResponse } from "@/types/common";
import type { SearchItemResponse, SearchItemsResponse } from "@/types/item";

const PRODUCT_TONES: Record<string, string> = {
  sports: "bg-cat-deporte",
  photography: "bg-cat-fotografia",
  camping: "bg-cat-aventura",
  music: "bg-cat-musica",
  tools: "bg-cat-herramientas",
  electronics: "bg-cat-electronica",
  home: "bg-cat-orange-alt",
  gardening: "bg-cat-deporte",
  vehicles: "bg-cat-blue-alt",
  clothing: "bg-cat-purple-alt",
  other: "bg-primary-light",
};

interface ProductsState {
  items: SearchItemResponse[];
  total: number;
  loading: boolean;
  error: string;
}

interface ReceivedReview {
  review_id: string;
  reviewer_id: string;
  reviewer_first_name: string;
  reviewer_last_name: string;
  reviewer_avatar_url?: string;
  rating: number;
  comment: string;
  reviewed_at: string;
}

interface ReviewsSummary {
  average_rating: number;
  total: number;
  distribution: Record<string, number>;
}

interface ReceivedReviewsResponse {
  items: ReceivedReview[];
  total: number;
  page: number;
  limit: number;
  summary: ReviewsSummary;
}

interface ReviewsState {
  items: ReceivedReview[];
  total: number;
  summary: ReviewsSummary;
  loading: boolean;
  error: string;
}

type ProductsAction =
  | { type: "fetch_start" }
  | { type: "fetch_success"; payload: SearchItemsResponse }
  | { type: "fetch_error"; error: string };

type ReviewsAction =
  | { type: "fetch_start" }
  | { type: "fetch_success"; payload: ReceivedReviewsResponse }
  | { type: "fetch_error"; error: string };

const initialProductsState: ProductsState = {
  items: [],
  total: 0,
  loading: true,
  error: "",
};

const emptyReviewsSummary: ReviewsSummary = {
  average_rating: 0,
  total: 0,
  distribution: {},
};

const initialReviewsState: ReviewsState = {
  items: [],
  total: 0,
  summary: emptyReviewsSummary,
  loading: true,
  error: "",
};

function productsReducer(state: ProductsState, action: ProductsAction): ProductsState {
  switch (action.type) {
    case "fetch_start":
      return { ...state, loading: true, error: "" };
    case "fetch_success":
      return {
        items: action.payload.items,
        total: action.payload.total,
        loading: false,
        error: "",
      };
    case "fetch_error":
      return {
        items: [],
        total: 0,
        loading: false,
        error: action.error,
      };
    default:
      return state;
  }
}

function reviewsReducer(state: ReviewsState, action: ReviewsAction): ReviewsState {
  switch (action.type) {
    case "fetch_start":
      return { ...state, loading: true, error: "" };
    case "fetch_success":
      return {
        items: action.payload.items,
        total: action.payload.total,
        summary: action.payload.summary,
        loading: false,
        error: "",
      };
    case "fetch_error":
      return {
        items: [],
        total: 0,
        summary: emptyReviewsSummary,
        loading: false,
        error: action.error,
      };
    default:
      return state;
  }
}

async function fetchMyItems(signal: AbortSignal): Promise<SearchItemsResponse> {
  const res = await fetch("/api/items/mine?limit=48", {
    credentials: "include",
    signal,
  });
  const json = (await res.json()) as ApiResponse<SearchItemsResponse>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message ?? json.error ?? "Error al cargar tus productos");
  }
  return json.data;
}

async function fetchReceivedReviews(signal: AbortSignal): Promise<ReceivedReviewsResponse> {
  const res = await fetch("/api/reviews/received?limit=4", {
    credentials: "include",
    signal,
  });
  const json = (await res.json()) as ApiResponse<ReceivedReviewsResponse>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message ?? json.error ?? "Error al cargar tus valoraciones");
  }
  return json.data;
}

function getInitials(firstName: string, lastName: string) {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
}

function formatMemberSince(date?: string) {
  if (!date) return "";

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";

  const months = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ];

  return `${months[parsed.getMonth()]} ${parsed.getFullYear()}`;
}

function getStatusLabel(product: SearchItemResponse) {
  if (product.item_status === "rented") return "Reservado";
  if (product.item_status === "retired") return "Retirado";
  if (product.is_available) return "Disponible";
  return "No disponible";
}

function uniqueProductCities(products: SearchItemResponse[]) {
  return Array.from(new Set(products.map((product) => product.city).filter(Boolean)));
}

function reviewerInitials(review: ReceivedReview) {
  return getInitials(review.reviewer_first_name, review.reviewer_last_name);
}

function reviewerDisplayName(review: ReceivedReview) {
  const lastInitial = review.reviewer_last_name[0] ? `${review.reviewer_last_name[0]}.` : "";
  return `${review.reviewer_first_name} ${lastInitial}`.trim();
}

function formatRelativeDate(value: string) {
  const created = new Date(value);
  if (Number.isNaN(created.getTime())) return "";

  const diffDays = Math.floor((Date.now() - created.getTime()) / 86_400_000);
  if (diffDays <= 0) return "Hoy";
  if (diffDays === 1) return "Hace 1 dia";
  if (diffDays < 7) return `Hace ${diffDays} dias`;

  const weeks = Math.floor(diffDays / 7);
  if (weeks === 1) return "Hace 1 semana";
  if (weeks < 5) return `Hace ${weeks} semanas`;

  const months = Math.floor(diffDays / 30);
  if (months <= 1) return "Hace 1 mes";
  return `Hace ${months} meses`;
}

function distributionPercent(count: number, total: number) {
  if (total === 0) return 0;
  return Math.round((count / total) * 100);
}

interface ProductCardProps {
  product: SearchItemResponse;
}

function ProfileProductCard({ product }: ProductCardProps) {
  const navigate = useNavigate();
  const tone = PRODUCT_TONES[product.category] ?? PRODUCT_TONES.other;
  const statusLabel = getStatusLabel(product);
  const isAvailable = product.is_available && product.item_status !== "retired" && product.item_status !== "rented";

  return (
    <article className="border-border-main bg-page overflow-hidden rounded-xl border">
      <button
        type="button"
        className={`${tone} relative block h-29 w-full overflow-hidden rounded-none p-0 text-left`}
        onClick={() => navigate(`/product/${product.item_id}`)}
        aria-label={`Abrir ${product.title}`}
      >
        {product.primary_image_url ? (
          <img
            src={product.primary_image_url}
            alt={product.title}
            className="h-full w-full object-cover"
          />
        ) : null}
        <span
          className={`absolute top-3 left-4 rounded-full px-3 py-1 text-[11px] font-medium ${
            isAvailable ? "bg-primary-light text-primary" : "bg-[#fff0c4] text-[#9b7411]"
          }`}
        >
          {isAvailable ? statusLabel : "No disponible"}
        </span>
      </button>

      <div className="p-3">
        <button
          type="button"
          className="block h-auto min-h-9 w-full p-0 text-left"
          onClick={() => navigate(`/product/${product.item_id}`)}
        >
          <h3 className="text-card-sm text-ink line-clamp-2 leading-snug font-medium">{product.title}</h3>
        </button>

        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="location truncate">{product.city || "Sin ubicacion"}</p>
          <button
            type="button"
            className="text-primary h-auto p-0 text-[12px]"
            onClick={() => navigate(`/product/${product.item_id}/edit`)}
          >
            Editar
            <ArrowRight size={12} />
          </button>
        </div>

        <p className="text-primary mt-2 text-[15px] font-bold">{Math.round(product.price_per_day)} EUR/dia</p>
      </div>
    </article>
  );
}

interface ReviewCardProps {
  review: ReceivedReview;
}

function ReviewCard({ review }: ReviewCardProps) {
  return (
    <article className="review-card">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {review.reviewer_avatar_url ? (
            <img
              src={review.reviewer_avatar_url}
              alt={reviewerDisplayName(review)}
              className="reviewer-avatar object-cover"
            />
          ) : (
            <div className="reviewer-avatar reviewer-avatar--blue">{reviewerInitials(review)}</div>
          )}
          <div className="min-w-0">
            <p className="text-card-sm font-bold">{reviewerDisplayName(review)}</p>
            <p className="text-card-loc text-subtle">{formatRelativeDate(review.reviewed_at)}</p>
          </div>
        </div>
        <StarRating
          rating={review.rating}
          className="text-review-star shrink-0"
        />
      </div>
      {review.comment && <p className="text-body-color leading-review mt-3">{review.comment}</p>}
    </article>
  );
}

interface ReviewsSectionProps {
  state: ReviewsState;
}

function ReviewsSection({ state }: ReviewsSectionProps) {
  const total = state.summary.total;
  const average = state.summary.average_rating;

  return (
    <section className="mt-12">
      <h2 className="heading-panel--sm">Valoraciones de otros usuarios</h2>

      {state.loading && (
        <div className="profile-info-panel mt-3 flex min-h-36 items-center justify-center p-6">
          <p className="text-subtle">Cargando valoraciones...</p>
        </div>
      )}

      {state.error && (
        <p className="border-report bg-error-danger text-report mt-3 rounded-lg border p-3 text-[13px]">
          {state.error}
        </p>
      )}

      {!state.loading && !state.error && total === 0 && (
        <div className="profile-info-panel mt-3 flex min-h-36 flex-col items-center justify-center p-6 text-center">
          <p className="text-ink font-medium">Todavia no hay valoraciones</p>
          <p className="text-subtle mt-1 text-[13px]">Cuando otros usuarios valoren tus alquileres apareceran aqui.</p>
        </div>
      )}

      {!state.loading && !state.error && total > 0 && (
        <>
          <div className="profile-info-panel mt-3 grid grid-cols-1 gap-8 p-6 md:grid-cols-[150px_minmax(0,1fr)] md:p-7">
            <div>
              <p className="rating-big-number leading-none">{average.toFixed(1)}</p>
              <p className="rating-count-label mt-2">
                de 5 - {total} {total === 1 ? "valoracion" : "valoraciones"}
              </p>
              <StarRating
                rating={average}
                className="text-stars-lg mt-2"
              />
            </div>

            <div className="space-y-2">
              {[5, 4, 3, 2, 1].map((stars) => {
                const count = state.summary.distribution[String(stars)] ?? 0;
                const percent = distributionPercent(count, total);

                return (
                  <div
                    key={stars}
                    className="grid grid-cols-[72px_minmax(0,1fr)_42px] items-center gap-2"
                  >
                    <p className="rating-bar-label">{stars} estrellas</p>
                    <div className="rating-bar-track">
                      <div
                        className="rating-bar-fill"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <p className="rating-bar-label text-right">{percent}%</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 space-y-4">
            {state.items.map((review) => (
              <ReviewCard
                key={review.review_id}
                review={review}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function ProductsSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          className="border-border-main bg-page animate-pulse overflow-hidden rounded-xl border"
        >
          <div className="bg-primary-light h-29" />
          <div className="space-y-3 p-3">
            <div className="bg-border-main h-4 w-4/5 rounded" />
            <div className="bg-border-main h-3 w-1/2 rounded" />
            <div className="bg-border-main h-5 w-24 rounded" />
          </div>
        </div>
      ))}
    </>
  );
}

/**
 * Displays the current user's profile overview.
 * @returns The current user's public profile dashboard.
 */
function MyProfile() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [productsState, dispatchProducts] = useReducer(productsReducer, initialProductsState);
  const [reviewsState, dispatchReviews] = useReducer(reviewsReducer, initialReviewsState);

  const firstName = user?.first_name ?? "";
  const lastName = user?.last_name ?? "";
  const fullName = `${firstName} ${lastName}`.trim();
  const initials = getInitials(firstName, lastName);
  const memberSince = formatMemberSince(user?.registration_date);
  const cities = uniqueProductCities(productsState.items);

  const activeProducts = productsState.items.filter(
    (product) => product.is_available && product.item_status !== "retired"
  ).length;
  const rentedProducts = productsState.items.filter((product) => product.item_status === "rented").length;
  const profileStats = useMemo(
    () => [
      { value: activeProducts, label: "Productos activos" },
      {
        value: reviewsState.summary.average_rating > 0 ? reviewsState.summary.average_rating.toFixed(1) : "0",
        label: "Valoracion media",
      },
      { value: reviewsState.total, label: "Valoraciones recibidas" },
      { value: productsState.total, label: "Productos publicados" },
      { value: rentedProducts, label: "Reservados" },
    ],
    [activeProducts, productsState.total, rentedProducts, reviewsState.summary.average_rating, reviewsState.total]
  );

  const profileMeta = [cities.join(", "), memberSince ? `Miembro desde ${memberSince}` : ""]
    .filter(Boolean)
    .join(" - ");

  const verifications = [
    { label: "Email vinculado", done: Boolean(user?.email) },
    { label: "Telefono vinculado", done: Boolean(user?.phone) },
  ];

  useEffect(() => {
    const controller = new AbortController();

    dispatchProducts({ type: "fetch_start" });
    fetchMyItems(controller.signal)
      .then((data) => dispatchProducts({ type: "fetch_success", payload: data }))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        dispatchProducts({
          type: "fetch_error",
          error: err instanceof Error ? err.message : "Error al cargar tus productos",
        });
      });

    fetchReceivedReviews(controller.signal)
      .then((data) => dispatchReviews({ type: "fetch_success", payload: data }))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        dispatchReviews({
          type: "fetch_error",
          error: err instanceof Error ? err.message : "Error al cargar tus valoraciones",
        });
      });

    return () => controller.abort();
  }, []);

  return (
    <div className="bg-page min-h-screen">
      <section className="profile-hero min-h-profile-hero h-auto">
        <div className="mx-auto flex h-full max-w-340 flex-col items-start justify-center gap-5 px-6 py-6 md:flex-row md:items-center md:justify-between md:px-10">
          <div>
            <span className="profile-public-badge mb-1">Tu perfil publico</span>
            <div className="mt-2 flex items-center gap-5">
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={fullName}
                  className="avatar-hero"
                />
              ) : (
                <div className="profile-avatar-hero">{initials}</div>
              )}
              <div>
                <p className="profile-name">{fullName}</p>
                {profileMeta && <p className="profile-meta mt-1">{profileMeta}</p>}
              </div>
            </div>
          </div>

          <button
            type="button"
            className="btn-profile-action h-9 px-4"
            onClick={() => navigate("/profile/edit")}
          >
            Editar perfil
            <ArrowRight size={15} />
          </button>
        </div>
      </section>

      <section className="profile-stats-strip h-auto py-5">
        <div className="mx-auto grid w-full max-w-250 grid-cols-2 gap-y-5 md:grid-cols-3 lg:grid-cols-5">
          {profileStats.map((stat, index) => (
            <div
              key={stat.label}
              className={`text-center ${index > 0 ? "border-border-input border-l" : ""}`}
            >
              <p className={stat.label === "Valoracion media" ? "profile-stat-value--rating" : "profile-stat-value"}>
                {stat.label === "Valoracion media" && !reviewsState.loading ? (
                  <Star
                    className="mr-1 inline"
                    size={17}
                    fill="currentColor"
                  />
                ) : null}
                {productsState.loading || reviewsState.loading ? "..." : stat.value}
              </p>
              <p className="profile-stat-label mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      <main className="mx-auto max-w-340 px-6 pt-9 pb-12 md:px-10">
        <div className="mx-auto max-w-196">
          <section className="profile-info-panel px-5 py-4">
            <p className="profile-verif-heading mb-2">Datos vinculados</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {verifications.map((verification) => (
                <p
                  key={verification.label}
                  className={verification.done ? "profile-verified" : "profile-unverified"}
                >
                  {verification.done ? (
                    <Check
                      className="mr-1 inline"
                      size={13}
                    />
                  ) : (
                    <Circle
                      className="mr-1 inline"
                      size={10}
                    />
                  )}
                  {verification.label}
                </p>
              ))}
            </div>
          </section>

          <section className="mt-5">
            <h2 className="heading-panel--sm">Articulos en alquiler</h2>
            <p className="profile-products-sub mt-1">
              {productsState.loading
                ? "Cargando tus productos..."
                : `${productsState.total} ${productsState.total === 1 ? "producto publicado" : "productos publicados"}`}
            </p>
            {productsState.error && (
              <p className="border-report bg-error-danger text-report mt-3 rounded-lg border p-3 text-[13px]">
                {productsState.error}
              </p>
            )}
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {productsState.loading ? (
                <ProductsSkeleton />
              ) : (
                productsState.items.map((product) => (
                  <ProfileProductCard
                    key={product.item_id}
                    product={product}
                  />
                ))
              )}
            </div>
            {!productsState.loading && productsState.items.length === 0 && !productsState.error && (
              <div className="profile-info-panel mt-3 flex min-h-36 flex-col items-center justify-center p-6 text-center">
                <p className="text-ink font-medium">Todavia no has publicado productos</p>
                <p className="text-subtle mt-1 text-[13px]">Cuando publiques articulos apareceran aqui.</p>
                <button
                  type="button"
                  className="btn-primary btn--sm mt-4"
                  onClick={() => navigate("/product/new")}
                >
                  Publicar articulo
                </button>
              </div>
            )}
          </section>

          <ReviewsSection state={reviewsState} />
        </div>
      </main>
    </div>
  );
}

export { MyProfile };
