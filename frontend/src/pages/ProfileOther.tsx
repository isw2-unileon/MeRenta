import { useEffect, useMemo, useReducer, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BadgeCheck, Heart, Mail, Star, X } from "lucide-react";

import { StarRating } from "@/components/product/detail/StarRating";
import type { ApiResponse } from "@/types/common";
import type { CustomerProfile } from "@/types/customer";
import type { SearchItemResponse, SearchItemsResponse } from "@/types/item";
import type { ReviewSummary } from "@/types/review";
import { useAuth } from "@/hooks/useAuth";
import {
  formatMemberSince,
  getInitials,
  initialProductsState,
  productsReducer,
  uniqueProductCities,
  type ReceivedReviewsResponseBase,
} from "@/components/profile/profileShared";

const emptyReviewSummary: ReviewSummary = {
  average_rating: 0,
  total: 0,
  distribution: {
    "5": 0,
    "4": 0,
    "3": 0,
    "2": 0,
    "1": 0,
  },
};

const productTones: Record<string, string> = {
  sports: "bg-cat-deporte",
  photography: "bg-cat-fotografia",
  camping: "bg-cat-aventura",
  tools: "bg-cat-herramientas",
  electronics: "bg-cat-blue-alt",
  home: "bg-cat-orange-alt",
  gardening: "bg-cat-deporte",
  vehicles: "bg-cat-blue-alt",
  clothing: "bg-cat-purple-alt",
  music: "bg-cat-musica",
  leisure: "bg-cat-purple-alt2",
  other: "bg-primary-light",
};

const categoryLabels: Record<string, string> = {
  sports: "Deporte",
  photography: "Fotografía",
  camping: "Camping",
  tools: "Herramientas",
  electronics: "Electronica",
  home: "Hogar",
  gardening: "Jardinería",
  vehicles: "Vehículos",
  clothing: "Ropa",
  music: "Musica",
  leisure: "Ocio",
  other: "Otros",
};

interface PublicProfileState {
  profile: CustomerProfile | null;
  loading: boolean;
  error: string;
}

type PublicProfileAction =
  | { type: "fetch_start" }
  | { type: "fetch_success"; payload: CustomerProfile }
  | { type: "fetch_error"; error: string };

const initialProfileState: PublicProfileState = {
  profile: null,
  loading: true,
  error: "",
};

function profileReducer(state: PublicProfileState, action: PublicProfileAction): PublicProfileState {
  switch (action.type) {
    case "fetch_start":
      return { ...state, loading: true, error: "" };
    case "fetch_success":
      return { profile: action.payload, loading: false, error: "" };
    case "fetch_error":
      return { profile: null, loading: false, error: action.error };
    default:
      return state;
  }
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

type ReceivedReviewsResponse = ReceivedReviewsResponseBase<ReceivedReview>;

type UserIncidentType = "not_delivered" | "late_return" | "other";

const userIncidentOptions: { value: UserIncidentType; label: string }[] = [
  { value: "not_delivered", label: "No entrego el articulo" },
  { value: "late_return", label: "Devolución tardía" },
  { value: "other", label: "Otra incidencia" },
];

interface ReviewsState {
  items: ReceivedReview[];
  total: number;
  summary: ReviewSummary;
  loading: boolean;
  error: string;
}

type ReviewsAction =
  | { type: "fetch_start" }
  | { type: "fetch_success"; payload: ReceivedReviewsResponse }
  | { type: "fetch_error"; error: string };

const initialReviewsState: ReviewsState = {
  items: [],
  total: 0,
  summary: emptyReviewSummary,
  loading: true,
  error: "",
};

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
        summary: emptyReviewSummary,
        loading: false,
        error: action.error,
      };
    default:
      return state;
  }
}

async function fetchPublicProfile(id: string, signal: AbortSignal): Promise<CustomerProfile> {
  const res = await fetch(`/api/customers/${id}/profile`, {
    credentials: "include",
    signal,
  });
  const json = (await res.json()) as ApiResponse<CustomerProfile>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message ?? json.error ?? "Error al cargar el perfil");
  }
  return json.data;
}

async function fetchOwnerProducts(ownerId: string, signal: AbortSignal): Promise<SearchItemsResponse> {
  const res = await fetch(`/api/customers/${ownerId}/items?limit=48`, {
    credentials: "include",
    signal,
  });
  const json = (await res.json()) as ApiResponse<SearchItemsResponse>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message ?? json.error ?? "Error al cargar los productos");
  }
  return json.data;
}

async function fetchReceivedReviews(ownerId: string, signal: AbortSignal): Promise<ReceivedReviewsResponse> {
  const res = await fetch(`/api/reviews/received/${ownerId}?limit=4`, {
    credentials: "include",
    signal,
  });
  const json = (await res.json()) as ApiResponse<ReceivedReviewsResponse>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message ?? json.error ?? "Error al cargar las valoraciones");
  }
  return json.data;
}

async function createReview(reviewedId: string, rating: number, comment: string): Promise<ReceivedReview> {
  const res = await fetch("/api/reviews", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      reviewed_id: reviewedId,
      rating,
      comment: comment.trim(),
    }),
  });
  const json = (await res.json()) as ApiResponse<ReceivedReview>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message ?? json.error ?? "Error al guardar la valoración");
  }
  return json.data;
}

async function openConversation(itemId: string): Promise<string> {
  const res = await fetch("/api/conversations", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ item_id: itemId }),
  });
  const json = (await res.json()) as ApiResponse<{ conversation_id: string }>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message ?? json.error ?? "Error al abrir el chat");
  }
  return json.data.conversation_id;
}

async function createUserReport(profileId: string, type: UserIncidentType, description: string): Promise<void> {
  const res = await fetch(`/api/customers/${profileId}/reports`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type,
      description: description.trim(),
    }),
  });
  const json = (await res.json()) as ApiResponse<unknown>;
  if (!res.ok || !json.success) {
    throw new Error(json.message ?? json.error ?? "Error al crear la incidencia");
  }
}

function formatCompactMemberSince(date?: string) {
  const formatted = formatMemberSince(date);
  return formatted ? `Miembro desde ${formatted}` : "Miembro desde fecha no disponible";
}

function formatRelativeDate(value: string) {
  const created = new Date(value);
  if (Number.isNaN(created.getTime())) return "";

  const diffDays = Math.floor((Date.now() - created.getTime()) / 86_400_000);
  if (diffDays <= 0) return "Hoy";
  if (diffDays === 1) return "Hace 1 dia";
  if (diffDays < 7) return `Hace ${diffDays} días`;

  const weeks = Math.floor(diffDays / 7);
  if (weeks === 1) return "Hace 1 semana";
  if (weeks < 5) return `Hace ${weeks} semanas`;

  const months = Math.floor(diffDays / 30);
  if (months <= 1) return "Hace 1 mes";
  return `Hace ${months} meses`;
}

function reviewerInitials(review: ReceivedReview) {
  return getInitials(review.reviewer_first_name, review.reviewer_last_name);
}

function reviewerDisplayName(review: ReceivedReview) {
  const lastInitial = review.reviewer_last_name[0] ? `${review.reviewer_last_name[0]}.` : "";
  return `${review.reviewer_first_name} ${lastInitial}`.trim();
}

function percent(part: number, total: number) {
  if (total === 0) return 0;
  return Math.round((part / total) * 100);
}

function ProductCard({ product, ownerRating }: { product: SearchItemResponse; ownerRating: number }) {
  const navigate = useNavigate();
  const tone = productTones[product.category] ?? productTones.other;
  const isAvailable = product.is_available && product.item_status !== "rented" && product.item_status !== "retired";

  return (
    <article className="border-border-main bg-page overflow-hidden rounded-xl border transition-shadow hover:shadow-md">
      <button
        type="button"
        className={`${tone} relative block h-34 w-full overflow-hidden rounded-none p-0 text-left`}
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
          {isAvailable ? "Disponible" : "No disponible"}
        </span>
        <span className="text-heart-inactive absolute top-3 right-3 flex size-8 items-center justify-center rounded-full bg-white">
          <Heart size={17} />
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
          <p className="location truncate">{product.city || "Sin ubicación"}</p>
          <p className="text-card-loc text-rating flex items-center gap-1">
            <Star
              size={12}
              fill="currentColor"
            />
            {ownerRating > 0 ? ownerRating.toFixed(1) : "Sin valorar"}
          </p>
        </div>

        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-primary text-[15px] font-bold">{Math.round(product.price_per_day)} EUR/dia</p>
          <button
            type="button"
            className="btn-primary btn--sm"
            disabled={!isAvailable}
            onClick={() => navigate(`/product/${product.item_id}`)}
          >
            Alquilar
          </button>
        </div>
      </div>
    </article>
  );
}

function RatingSummary({ summary }: { summary: ReviewSummary }) {
  const total = summary.total;

  return (
    <div className="profile-info-panel mt-3 grid grid-cols-1 gap-8 p-6 md:grid-cols-[150px_minmax(0,1fr)] md:p-7">
      <div>
        <p className="rating-big-number leading-none">{summary.average_rating.toFixed(1)}</p>
        <p className="rating-count-label mt-2">
          de 5 - {summary.total} {summary.total === 1 ? "valoración" : "valoraciones"}
        </p>
        <StarRating
          rating={summary.average_rating}
          className="text-stars-lg mt-2"
        />
      </div>

      <div className="space-y-2">
        {[5, 4, 3, 2, 1].map((stars) => {
          const count = summary.distribution[String(stars)] ?? 0;
          const ratingPercent = percent(count, total);

          return (
            <div
              key={stars}
              className="grid grid-cols-[32px_minmax(0,1fr)_42px] items-center gap-2"
            >
              <p className="rating-bar-label">{stars} estrellas</p>
              <div className="rating-bar-track">
                <div
                  className="rating-bar-fill"
                  style={{ width: `${ratingPercent}%` }}
                />
              </div>
              <p className="rating-bar-label text-right">{ratingPercent}%</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReviewCard({ review }: { review: ReceivedReview }) {
  return (
    <article className="review-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
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
            <p className="review-author">{reviewerDisplayName(review)}</p>
            <p className="review-date">{formatRelativeDate(review.reviewed_at)}</p>
          </div>
        </div>
        <StarRating
          rating={review.rating}
          className="text-review-star shrink-0"
        />
      </div>
      {review.comment && <p className="review-body mt-4">{review.comment}</p>}
    </article>
  );
}

interface ReviewFormProps {
  profileName: string;
  rating: number;
  comment: string;
  submitting: boolean;
  error: string;
  success: string;
  onRatingChange: (rating: number) => void;
  onCommentChange: (comment: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

function ReviewForm({
  profileName,
  rating,
  comment,
  submitting,
  error,
  success,
  onRatingChange,
  onCommentChange,
  onSubmit,
}: ReviewFormProps) {
  return (
    <form
      className="profile-info-panel mt-4 p-5"
      onSubmit={onSubmit}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="profile-about-heading">Escribe una valoracion</p>
          <p className="profile-products-sub mt-1">Puntua tu experiencia con {profileName || "este usuario"}.</p>
        </div>

        <div
          className="flex items-center gap-1"
          role="radiogroup"
          aria-label="Puntuacion"
        >
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              className="text-rating size-8 p-0"
              aria-label={`${value} estrellas`}
              aria-checked={rating === value}
              role="radio"
              onClick={() => onRatingChange(value)}
            >
              <Star
                size={22}
                fill={value <= rating ? "currentColor" : "none"}
              />
            </button>
          ))}
        </div>
      </div>

      <label className="text-card-sm text-subtle mt-4 mb-2">
        Comentario
        <textarea
          value={comment}
          onChange={(event) => onCommentChange(event.target.value)}
          placeholder="Cuenta como fue tu experiencia..."
          maxLength={1000}
          className="mt-2 min-h-28"
        />
      </label>

      {error && (
        <p className="border-report bg-error-danger text-report mt-3 rounded-lg border p-3 text-[13px]">{error}</p>
      )}
      {success && (
        <p className="border-primary-border bg-primary-light text-primary mt-3 rounded-lg border p-3 text-[13px]">
          {success}
        </p>
      )}

      <div className="mt-4 flex justify-end">
        <button
          type="submit"
          className="btn-primary btn--sm min-w-36"
          disabled={submitting || rating === 0}
        >
          {submitting ? "Enviando..." : "Publicar valoración"}
        </button>
      </div>
    </form>
  );
}

// ── Review-draft state ────────────────────────────────────────────
interface ReviewDraftState {
  profileId: string;
  rating: number;
  comment: string;
  error: string;
  success: string;
  submitting: boolean;
}

type ReviewDraftAction =
  | { type: "set_rating"; profileId: string; rating: number }
  | { type: "set_comment"; profileId: string; comment: string }
  | { type: "submit_start"; profileId: string }
  | { type: "submit_success" }
  | { type: "submit_error"; error: string };

const initialReviewDraftState: ReviewDraftState = {
  profileId: "",
  rating: 0,
  comment: "",
  error: "",
  success: "",
  submitting: false,
};

function reviewDraftReducer(state: ReviewDraftState, action: ReviewDraftAction): ReviewDraftState {
  switch (action.type) {
    case "set_rating":
      return { ...state, profileId: action.profileId, rating: action.rating, error: "", success: "" };
    case "set_comment":
      return { ...state, profileId: action.profileId, comment: action.comment, error: "", success: "" };
    case "submit_start":
      return { ...state, profileId: action.profileId, submitting: true, error: "", success: "" };
    case "submit_success":
      return { ...state, submitting: false, rating: 0, comment: "", success: "Valoración publicada correctamente." };
    case "submit_error":
      return { ...state, submitting: false, error: action.error };
    default:
      return state;
  }
}

// ── Message-flow state ────────────────────────────────────────────
interface MessageFlowState {
  error: string;
  opening: boolean;
}

type MessageFlowAction = { type: "open_start" } | { type: "open_error"; error: string };

const initialMessageFlowState: MessageFlowState = { error: "", opening: false };

function messageFlowReducer(_state: MessageFlowState, action: MessageFlowAction): MessageFlowState {
  switch (action.type) {
    case "open_start":
      return { opening: true, error: "" };
    case "open_error":
      return { opening: false, error: action.error };
    default:
      return _state;
  }
}

function UserReportModal({
  profileId,
  profileName,
  onClose,
  onSuccess,
}: {
  profileId: string;
  profileName: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [incidentType, setIncidentType] = useState<UserIncidentType>("other");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedDescription = description.trim();
    if (trimmedDescription.length < 10) {
      setError("Describe la incidencia con al menos 10 caracteres.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await createUserReport(profileId, incidentType, trimmedDescription);
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al crear la incidencia");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8">
      <div className="bg-page w-full max-w-[35rem] rounded-lg p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="heading-panel--sm">Reportar usuario</h2>
            <p className="text-subtle mt-1 text-[13px]">{profileName || "Usuario seleccionado"}</p>
          </div>
          <button
            type="button"
            className="border-border-input text-subtle hover:text-ink flex size-9 items-center justify-center rounded-full border bg-white p-0"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X size={17} />
          </button>
        </div>

        <form
          className="mt-5 space-y-5"
          onSubmit={handleSubmit}
        >
          <div>
            <p className="text-ink text-[13px] font-semibold">Tipo de incidencia</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {userIncidentOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`min-h-11 rounded-lg border px-3 text-[13px] font-medium ${
                    incidentType === option.value
                      ? "border-primary bg-primary-light text-primary"
                      : "border-border-input bg-page text-body-color hover:border-primary hover:text-primary"
                  }`}
                  onClick={() => setIncidentType(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="text-ink text-[13px] font-semibold">Descripcion</span>
            <textarea
              className="border-border-input text-body-color focus:border-primary mt-2 min-h-32 w-full resize-none rounded-lg border bg-white px-3 py-2 text-[14px] outline-none"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Explica que ha ocurrido"
              maxLength={2000}
              required
            />
          </label>

          {error && (
            <p className="border-report bg-error-danger text-report rounded-lg border p-3 text-[13px]">{error}</p>
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              className="border-border-input text-body-color hover:border-primary hover:text-primary h-11 rounded-lg border bg-white px-5"
              onClick={onClose}
              disabled={submitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-primary h-11 px-5"
              disabled={submitting}
            >
              {submitting ? "Enviando..." : "Crear incidencia"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Shared data/action shapes passed to subsections ─────────────
interface ProfileViewData {
  fullName: string;
  initials: string;
  avatarUrl?: string;
  cityLabel: string;
  memberSince: string;
  summary: ReviewSummary;
  activeProducts: number;
  positivePercent: number;
  fiveStarPercent: number;
  isVerified: boolean;
}

interface ProfileActionProps {
  openingMessage: boolean;
  isOwnProfile: boolean;
  productsLoading: boolean;
  messageError: string;
  reportSuccess: boolean;
  onOpenMessage: () => void;
  onReportUser: () => void;
}

// ── Profile hero ──────────────────────────────────────────────────
function ProfileHero({
  data,
  profileLoading,
  openingMessage,
  isOwnProfile,
  productsLoading,
  messageError,
  reportSuccess,
  onOpenMessage,
  onReportUser,
}: { data: ProfileViewData; profileLoading: boolean } & ProfileActionProps) {
  return (
    <section className="profile-hero min-h-profile-hero h-auto bg-[#f0eef9]">
      <div className="mx-auto flex h-full max-w-340 flex-col items-start justify-center gap-6 px-6 py-8 md:flex-row md:items-center md:justify-between md:px-10">
        <div className="flex items-center gap-5">
          {data.avatarUrl ? (
            <img
              src={data.avatarUrl}
              alt={data.fullName}
              className="avatar-hero"
            />
          ) : (
            <div className="profile-avatar-hero bg-avatar-blue text-avatar-text-blue">{data.initials || "?"}</div>
          )}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="profile-name">{profileLoading ? "Cargando perfil..." : data.fullName}</p>
              {data.isVerified && (
                <BadgeCheck
                  size={26}
                  className="text-primary shrink-0"
                  aria-label="Perfil verificado"
                />
              )}
            </div>
            <p className="profile-meta mt-1">
              {data.cityLabel} - {data.memberSince}
            </p>
            <p className="text-rating mt-1 flex items-center gap-2 text-[13px]">
              <Star
                size={14}
                fill="currentColor"
              />
              {data.summary.average_rating.toFixed(1)} - {data.summary.total} valoraciones
            </p>
          </div>
        </div>

        <div className="flex flex-col items-start gap-4 md:items-center">
          <button
            type="button"
            className="btn-primary h-11 px-7"
            onClick={() => void onOpenMessage()}
            disabled={openingMessage || isOwnProfile || productsLoading}
          >
            <Mail size={15} /> {openingMessage ? "Abriendo..." : "Enviar mensaje"}
          </button>
          <button
            type="button"
            className="text-report h-auto p-0 text-[12px]"
            onClick={onReportUser}
            disabled={isOwnProfile}
          >
            Reportar usuario
          </button>
          {reportSuccess && <p className="text-primary max-w-60 text-center text-[12px]">Incidencia enviada.</p>}
          {messageError && <p className="text-report max-w-60 text-center text-[12px]">{messageError}</p>}
        </div>
      </div>
    </section>
  );
}

// ── Stats strip ───────────────────────────────────────────────────
interface StatItem {
  value: string | number;
  label: string;
  rating?: boolean;
}

function ProfileStatsStrip({ stats }: { stats: StatItem[] }) {
  return (
    <section className="profile-stats-strip h-auto py-5">
      <div className="mx-auto grid w-full max-w-340 grid-cols-2 gap-y-5 md:grid-cols-3 lg:grid-cols-6">
        {stats.map((stat, index) => (
          <div
            key={stat.label}
            className={`px-3 text-center ${index > 0 ? "border-border-input border-l" : ""}`}
          >
            <p className={stat.rating ? "profile-stat-value--rating" : "profile-stat-value"}>
              {stat.rating ? (
                <Star
                  className="mr-1 inline"
                  size={17}
                  fill="currentColor"
                />
              ) : null}
              {stat.value}
            </p>
            <p className="profile-stat-label mt-1">{stat.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Sidebar card ──────────────────────────────────────────────────
function ProfileSidebar({
  data,
  openingMessage,
  isOwnProfile,
  productsLoading,
  messageError,
  reportSuccess,
  onOpenMessage,
  onReportUser,
}: { data: ProfileViewData } & ProfileActionProps) {
  return (
    <aside className="lg:sticky lg:top-24 lg:self-start">
      <div className="profile-info-panel p-5">
        <div className="flex items-center gap-4">
          {data.avatarUrl ? (
            <img
              src={data.avatarUrl}
              alt={data.fullName}
              className="owner-avatar object-cover"
            />
          ) : (
            <div className="owner-avatar bg-avatar-blue text-avatar-text-blue">{data.initials || "?"}</div>
          )}
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="text-owner-name font-bold">{data.fullName || "Perfil publico"}</p>
              {data.isVerified && (
                <BadgeCheck
                  size={18}
                  className="text-primary shrink-0"
                  aria-label="Perfil verificado"
                />
              )}
            </div>
            <p className="text-card-loc text-subtle">
              {data.memberSince} - {data.cityLabel}
            </p>
            <p className="text-rating text-card-loc mt-1">
              {data.summary.average_rating.toFixed(1)} ({data.summary.total} valoraciones)
            </p>
          </div>
        </div>

        <div className="divide-border-main my-5 divide-y">
          {[
            ["Valoración media", data.summary.average_rating.toFixed(1)],
            ["Valoraciones recibidas", String(data.summary.total)],
            ["Opiniones positivas", `${data.positivePercent}%`],
            ["Valoraciones de 5 estrellas", `${data.fiveStarPercent}%`],
            ["Productos activos", String(data.activeProducts)],
          ].map(([label, value]) => (
            <div
              key={label}
              className="flex items-center justify-between gap-4 py-3 text-[12px]"
            >
              <span className="text-subtle">{label}</span>
              <span className="text-ink text-right font-bold">{value}</span>
            </div>
          ))}
        </div>

        <button
          type="button"
          className="btn-primary h-12 w-full"
          onClick={() => void onOpenMessage()}
          disabled={openingMessage || isOwnProfile || productsLoading}
        >
          <Mail size={15} /> {openingMessage ? "Abriendo..." : "Enviar mensaje"}
        </button>
        {messageError && <p className="text-report mt-3 text-center text-[12px]">{messageError}</p>}
        <button
          type="button"
          className="text-report mt-4 h-auto w-full p-0 text-[12px]"
          onClick={onReportUser}
          disabled={isOwnProfile}
        >
          Reportar a este usuario
        </button>
        {reportSuccess && <p className="text-primary mt-3 text-center text-[12px]">Incidencia enviada.</p>}
      </div>
    </aside>
  );
}

// ── Products section ─────────────────────────────────────────────
interface ProfileProductsSectionProps {
  firstName?: string;
  loading: boolean;
  error: string;
  visibleProducts: SearchItemResponse[];
  categoryFilters: { value: string; label: string }[];
  selectedCategory: string;
  ownerRating: number;
  onCategoryChange: (category: string) => void;
}

function ProfileProductsSection({
  firstName,
  loading,
  error,
  visibleProducts,
  categoryFilters,
  selectedCategory,
  ownerRating,
  onCategoryChange,
}: ProfileProductsSectionProps) {
  return (
    <section className="mt-22">
      <h2 className="heading-panel--sm">Articulos de {firstName ?? "este usuario"} en alquiler</h2>
      <p className="profile-products-sub mt-1">
        {loading
          ? "Cargando productos..."
          : `${visibleProducts.length} ${visibleProducts.length === 1 ? "producto disponible" : "productos disponibles"}`}
      </p>

      {categoryFilters.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-3">
          {categoryFilters.map((filter) => (
            <button
              key={filter.value}
              type="button"
              className={`h-7 rounded-full border px-5 text-[12px] ${
                selectedCategory === filter.value
                  ? "bg-primary text-white"
                  : "border-border-input bg-page text-subtle hover:border-primary hover:text-primary"
              }`}
              onClick={() => onCategoryChange(filter.value)}
            >
              {filter.label}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p className="border-report bg-error-danger text-report mt-3 rounded-lg border p-3 text-[13px]">{error}</p>
      )}

      {!loading && visibleProducts.length === 0 && !error && (
        <div className="profile-info-panel mt-4 flex min-h-36 items-center justify-center p-6 text-center">
          <p className="text-subtle">Este usuario no tiene productos publicados en esta categoria.</p>
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visibleProducts.map((product) => (
          <ProductCard
            key={product.item_id}
            product={product}
            ownerRating={ownerRating}
          />
        ))}
      </div>
    </section>
  );
}

// ── Reviews section ───────────────────────────────────────────────
interface ReviewFormDraft {
  rating: number;
  comment: string;
  submitting: boolean;
  error: string;
  success: string;
}

interface ProfileReviewsSectionProps {
  isOwnProfile: boolean;
  hasProfile: boolean;
  fullName: string;
  loading: boolean;
  error: string;
  total: number;
  items: ReceivedReview[];
  summary: ReviewSummary;
  draft: ReviewFormDraft;
  onRatingChange: (rating: number) => void;
  onCommentChange: (comment: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

function ProfileReviewsSection({
  isOwnProfile,
  hasProfile,
  fullName,
  loading,
  error,
  total,
  items,
  summary,
  draft,
  onRatingChange,
  onCommentChange,
  onSubmit,
}: ProfileReviewsSectionProps) {
  return (
    <section className="mt-14">
      <h2 className="heading-panel--sm">Valoraciones recibidas</h2>

      {!isOwnProfile && hasProfile && (
        <ReviewForm
          profileName={fullName}
          rating={draft.rating}
          comment={draft.comment}
          submitting={draft.submitting}
          error={draft.error}
          success={draft.success}
          onRatingChange={onRatingChange}
          onCommentChange={onCommentChange}
          onSubmit={onSubmit}
        />
      )}

      {error && (
        <p className="border-report bg-error-danger text-report mt-3 rounded-lg border p-3 text-[13px]">{error}</p>
      )}

      {loading ? (
        <div className="profile-info-panel mt-3 flex min-h-36 items-center justify-center p-6">
          <p className="text-subtle">Cargando valoraciones…</p>
        </div>
      ) : (
        <RatingSummary summary={summary} />
      )}

      {!loading && total === 0 && !error && (
        <div className="profile-info-panel mt-4 flex min-h-36 items-center justify-center p-6 text-center">
          <p className="text-subtle">Este usuario todavia no ha recibido valoraciones.</p>
        </div>
      )}

      <div className="mt-4 space-y-4">
        {items.map((review) => (
          <ReviewCard
            key={review.review_id}
            review={review}
          />
        ))}
      </div>

      {!loading && total > items.length && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            className="btn-secondary btn--sm min-w-64"
          >
            Ver las {total - items.length} valoraciones restantes
          </button>
        </div>
      )}
    </section>
  );
}

/**
 * Shows another user's public profile details.
 * @returns The public profile page.
 */
function ProfileOther() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  const [reviewDraft, dispatchReviewDraft] = useReducer(reviewDraftReducer, initialReviewDraftState);
  const [msgFlow, dispatchMsgFlow] = useReducer(messageFlowReducer, initialMessageFlowState);
  const [profileState, dispatchProfile] = useReducer(profileReducer, initialProfileState);
  const [productsState, dispatchProducts] = useReducer(productsReducer, initialProductsState);
  const [reviewsState, dispatchReviews] = useReducer(reviewsReducer, initialReviewsState);

  function loadReviews(ownerId: string, signal: AbortSignal) {
    dispatchReviews({ type: "fetch_start" });
    fetchReceivedReviews(ownerId, signal)
      .then((reviews) => dispatchReviews({ type: "fetch_success", payload: reviews }))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        dispatchReviews({
          type: "fetch_error",
          error: err instanceof Error ? err.message : "Error al cargar las valoraciones",
        });
      });
  }

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();

    dispatchProfile({ type: "fetch_start" });
    fetchPublicProfile(id, controller.signal)
      .then((profile) => dispatchProfile({ type: "fetch_success", payload: profile }))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        dispatchProfile({
          type: "fetch_error",
          error: err instanceof Error ? err.message : "Error al cargar el perfil",
        });
      });

    dispatchProducts({ type: "fetch_start" });
    fetchOwnerProducts(id, controller.signal)
      .then((products) => dispatchProducts({ type: "fetch_success", payload: products }))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        dispatchProducts({
          type: "fetch_error",
          error: err instanceof Error ? err.message : "Error al cargar los productos",
        });
      });

    loadReviews(id, controller.signal);

    return () => controller.abort();
  }, [id]);

  const profile = profileState.profile;
  const products = productsState.items.filter((product) => product.item_status !== "retired");
  const summary = reviewsState.summary;
  const fullName = profile ? `${profile.first_name} ${profile.last_name}`.trim() : "";
  const initials = profile ? getInitials(profile.first_name, profile.last_name) : "";
  const cities = uniqueProductCities(products);
  const cityLabel = cities.join(", ") || "Ubicación no disponible";
  const memberSince = formatCompactMemberSince(profile?.registration_date);
  const activeProducts = products.filter((product) => product.is_available && product.item_status !== "retired").length;
  const messageProduct = products.find(
    (product) => product.is_available && product.item_status !== "retired" && product.item_status !== "rented"
  );
  const positiveReviews = (summary.distribution["5"] ?? 0) + (summary.distribution["4"] ?? 0);
  const positivePercent = percent(positiveReviews, summary.total);
  const fiveStarPercent = percent(summary.distribution["5"] ?? 0, summary.total);
  const isOwnProfile = Boolean(user?.customer_id && id === user.customer_id);
  const isDraftForCurrentProfile = reviewDraft.profileId === (id ?? "");
  const currentDraftRating = isDraftForCurrentProfile ? reviewDraft.rating : 0;
  const currentDraftComment = isDraftForCurrentProfile ? reviewDraft.comment : "";
  const currentSubmitError = isDraftForCurrentProfile ? reviewDraft.error : "";
  const currentSubmitSuccess = isDraftForCurrentProfile ? reviewDraft.success : "";

  const handleReviewSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!id || currentDraftRating < 1 || currentDraftRating > 5) return;

    dispatchReviewDraft({ type: "submit_start", profileId: id });

    try {
      await createReview(id, currentDraftRating, currentDraftComment);
      dispatchReviewDraft({ type: "submit_success" });
      const controller = new AbortController();
      loadReviews(id, controller.signal);
    } catch (err: unknown) {
      dispatchReviewDraft({
        type: "submit_error",
        error: err instanceof Error ? err.message : "Error al guardar la valoración",
      });
    }
  };

  const handleOpenMessage = async () => {
    if (isOwnProfile) {
      dispatchMsgFlow({ type: "open_error", error: "No puedes abrir una conversación contigo." });
      return;
    }
    if (!messageProduct) {
      dispatchMsgFlow({
        type: "open_error",
        error: "Este usuario no tiene productos disponibles para iniciar una conversación.",
      });
      return;
    }

    dispatchMsgFlow({ type: "open_start" });

    try {
      const conversationId = await openConversation(messageProduct.item_id);
      void navigate(`/chat/${conversationId}`);
    } catch (err: unknown) {
      dispatchMsgFlow({ type: "open_error", error: err instanceof Error ? err.message : "Error al abrir el chat" });
    }
  };

  const handleReportUser = () => {
    if (!id || isOwnProfile) return;
    setReportSuccess(false);
    setReportModalOpen(true);
  };

  const categoryFilters = useMemo(() => {
    const categories = Array.from(new Set(products.map((product) => product.category)));
    return [
      { value: "all", label: "Todos" },
      ...categories.map((category) => ({ value: category, label: categoryLabels[category] ?? category })),
    ];
  }, [products]);

  const visibleProducts = useMemo(
    () => (selectedCategory === "all" ? products : products.filter((product) => product.category === selectedCategory)),
    [products, selectedCategory]
  );

  const stats = useMemo(
    () => [
      { value: productsState.loading ? "..." : activeProducts, label: "Productos activos" },
      {
        value: reviewsState.loading ? "..." : summary.average_rating.toFixed(1),
        label: "Valoración media",
        rating: true,
      },
      { value: reviewsState.loading ? "..." : summary.total, label: "Valoraciones" },
      { value: reviewsState.loading ? "..." : `${positivePercent}%`, label: "Opiniones positivas" },
      { value: reviewsState.loading ? "..." : `${fiveStarPercent}%`, label: "5 estrellas" },
      { value: memberSince.replace("Miembro desde ", ""), label: "En la plataforma" },
    ],
    [
      activeProducts,
      fiveStarPercent,
      memberSince,
      positivePercent,
      productsState.loading,
      reviewsState.loading,
      summary.average_rating,
      summary.total,
    ]
  );

  const profileViewData: ProfileViewData = {
    fullName,
    initials,
    avatarUrl: profile?.avatar_url ?? undefined,
    cityLabel,
    memberSince,
    summary,
    activeProducts,
    positivePercent,
    fiveStarPercent,
    isVerified: profile?.verification_status === "verified",
  };

  const actionProps: ProfileActionProps = {
    openingMessage: msgFlow.opening,
    isOwnProfile,
    productsLoading: productsState.loading,
    messageError: msgFlow.error,
    reportSuccess,
    onOpenMessage: () => void handleOpenMessage(),
    onReportUser: handleReportUser,
  };

  if (profileState.error) {
    return (
      <div className="bg-page flex min-h-screen items-center justify-center px-6">
        <div className="profile-info-panel max-w-120 p-6 text-center">
          <h1 className="heading-panel--sm">No se pudo cargar el perfil</h1>
          <p className="text-body-color mt-2">{profileState.error}</p>
          <button
            type="button"
            className="btn-primary btn--sm mt-4"
            onClick={() => navigate("/search")}
          >
            Volver a explorar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-page min-h-screen">
      <ProfileHero
        data={profileViewData}
        profileLoading={profileState.loading}
        {...actionProps}
      />

      <ProfileStatsStrip stats={stats} />

      <main className="mx-auto grid max-w-340 grid-cols-1 gap-9 px-6 pt-9 pb-18 md:px-10 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <section className="profile-info-panel px-5 py-4">
            <p className="profile-about-heading">Resumen del perfil</p>
            <p className="profile-about-body mt-2">
              {fullName || "Este usuario"} tiene {activeProducts} productos activos y {summary.total} valoraciones
              recibidas. La informacion de confianza se calcula unicamente con las valoraciones publicadas por otros
              usuarios.
            </p>
          </section>

          <ProfileProductsSection
            firstName={profile?.first_name}
            loading={productsState.loading}
            error={productsState.error}
            visibleProducts={visibleProducts}
            categoryFilters={categoryFilters}
            selectedCategory={selectedCategory}
            ownerRating={summary.average_rating}
            onCategoryChange={setSelectedCategory}
          />

          <ProfileReviewsSection
            isOwnProfile={isOwnProfile}
            hasProfile={Boolean(profile)}
            fullName={fullName}
            loading={reviewsState.loading}
            error={reviewsState.error}
            total={reviewsState.total}
            items={reviewsState.items}
            summary={summary}
            draft={{
              rating: currentDraftRating,
              comment: currentDraftComment,
              submitting: reviewDraft.submitting,
              error: currentSubmitError,
              success: currentSubmitSuccess,
            }}
            onRatingChange={(rating) => dispatchReviewDraft({ type: "set_rating", profileId: id ?? "", rating })}
            onCommentChange={(comment) => dispatchReviewDraft({ type: "set_comment", profileId: id ?? "", comment })}
            onSubmit={handleReviewSubmit}
          />
        </div>

        <ProfileSidebar
          data={profileViewData}
          {...actionProps}
        />
      </main>
      {reportModalOpen && id && (
        <UserReportModal
          profileId={id}
          profileName={fullName}
          onClose={() => setReportModalOpen(false)}
          onSuccess={() => {
            setReportModalOpen(false);
            setReportSuccess(true);
          }}
        />
      )}
    </div>
  );
}

export { ProfileOther };
