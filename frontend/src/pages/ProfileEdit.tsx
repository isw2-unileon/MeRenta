import { useEffect, useMemo, useReducer, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Camera, Star, Trash2 } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import type { ApiResponse } from "@/types/common";
import type { CustomerPublic } from "@/types/customer";
import type { SearchItemResponse, SearchItemsResponse } from "@/types/item";

interface ProductsState {
  items: SearchItemResponse[];
  total: number;
  loading: boolean;
  error: string;
}

interface ReviewsSummary {
  average_rating: number;
  total: number;
  distribution: Record<string, number>;
}

interface ReceivedReviewsResponse {
  items: unknown[];
  total: number;
  page: number;
  limit: number;
  summary: ReviewsSummary;
}

interface ReviewsState {
  total: number;
  average: number;
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

const initialReviewsState: ReviewsState = {
  total: 0,
  average: 0,
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
        total: action.payload.total,
        average: action.payload.summary.average_rating,
        loading: false,
        error: "",
      };
    case "fetch_error":
      return {
        total: 0,
        average: 0,
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

async function updateProfile(payload: {
  first_name: string;
  last_name: string;
  phone: string | null;
  avatar_url: string | null;
}): Promise<CustomerPublic> {
  const res = await fetch("/api/me", {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const json = (await res.json()) as ApiResponse<CustomerPublic>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message ?? json.error ?? "Error al guardar los cambios");
  }
  return json.data;
}

async function updateEmail(payload: { email: string; confirm_email: string }): Promise<CustomerPublic> {
  const res = await fetch("/api/me/email", {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const json = (await res.json()) as ApiResponse<CustomerPublic>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message ?? json.error ?? "Error al cambiar el email");
  }
  return json.data;
}

async function uploadAvatar(file: File): Promise<CustomerPublic> {
  const formData = new FormData();
  formData.append("avatar", file);

  const res = await fetch("/api/me/avatar", {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  const json = (await res.json()) as ApiResponse<CustomerPublic>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message ?? json.error ?? "Error al guardar la foto de perfil");
  }
  return json.data;
}

async function updatePassword(payload: {
  current_password: string;
  new_password: string;
  confirm_new_password: string;
}): Promise<void> {
  const res = await fetch("/api/me/password", {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const json = (await res.json()) as ApiResponse<{ message: string }>;
  if (!res.ok || !json.success) {
    throw new Error(json.message ?? json.error ?? "Error al cambiar la contrasena");
  }
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

function uniqueProductCities(products: SearchItemResponse[]) {
  return Array.from(new Set(products.map((product) => product.city).filter(Boolean)));
}

/**
 * Form page for updating the current user's profile.
 * @returns The profile edit page.
 */
function ProfileEdit() {
  const { user } = useAuth();
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [productsState, dispatchProducts] = useReducer(productsReducer, initialProductsState);
  const [reviewsState, dispatchReviews] = useReducer(reviewsReducer, initialReviewsState);
  const [firstName, setFirstName] = useState(user?.first_name ?? "");
  const [lastName, setLastName] = useState(user?.last_name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [confirmEmail, setConfirmEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url ?? "");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState("");
  const [location, setLocation] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    if (!user) return;
    setFirstName(user.first_name);
    setLastName(user.last_name);
    setEmail(user.email);
    setConfirmEmail(user.email);
    setPhone(user.phone ?? "");
    setAvatarUrl(user.avatar_url ?? "");
    setAvatarFile(null);
    setAvatarPreviewUrl("");
  }, [user]);

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
    };
  }, [avatarPreviewUrl]);

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

    dispatchReviews({ type: "fetch_start" });
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

  const fullName = `${firstName} ${lastName}`.trim();
  const initials = getInitials(firstName, lastName);
  const displayAvatarUrl = avatarPreviewUrl || avatarUrl;
  const memberSince = formatMemberSince(user?.registration_date);
  const cities = uniqueProductCities(productsState.items);
  const activeProducts = productsState.items.filter(
    (product) => product.is_available && product.item_status !== "retired"
  ).length;
  const rentedProducts = productsState.items.filter((product) => product.item_status === "rented").length;

  const profileMeta = [cities.join(", "), memberSince ? `Miembro desde ${memberSince}` : ""]
    .filter(Boolean)
    .join(" - ");

  useEffect(() => {
    if (location || cities.length === 0) return;
    setLocation(cities.join(", "));
  }, [cities, location]);

  const stats = useMemo(
    () => [
      { value: productsState.loading ? "..." : activeProducts, label: "Productos" },
      { value: productsState.loading ? "..." : rentedProducts, label: "Reservados" },
      { value: reviewsState.loading ? "..." : reviewsState.total, label: "Valoraciones" },
    ],
    [activeProducts, rentedProducts, productsState.loading, reviewsState.loading, reviewsState.total]
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveError("");
    setSaveMessage("");

    const nextEmail = email.trim();
    const nextConfirmEmail = confirmEmail.trim();
    const emailChanged = nextEmail.toLowerCase() !== (user?.email ?? "").toLowerCase();

    if (emailChanged && nextEmail.toLowerCase() !== nextConfirmEmail.toLowerCase()) {
      setSaveError("El email y su confirmacion no coinciden.");
      return;
    }

    if (newPassword || confirmPassword || currentPassword) {
      if (!currentPassword || !newPassword || !confirmPassword) {
        setSaveError("Completa todos los campos de contrasena para cambiarla.");
        return;
      }
      if (newPassword !== confirmPassword) {
        setSaveError("La nueva contrasena y su confirmacion no coinciden.");
        return;
      }
    }

    setSaving(true);
    try {
      if (newPassword || confirmPassword || currentPassword) {
        await updatePassword({
          current_password: currentPassword,
          new_password: newPassword,
          confirm_new_password: confirmPassword,
        });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }

      if (emailChanged) {
        await updateEmail({
          email: nextEmail,
          confirm_email: nextConfirmEmail,
        });
      }
      await updateProfile({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim() || null,
        avatar_url: avatarUrl.trim() || null,
      });

      if (avatarFile) {
        const updated = await uploadAvatar(avatarFile);
        setAvatarUrl(updated.avatar_url ?? "");
        setAvatarFile(null);
        setAvatarPreviewUrl("");
      }

      setSaveMessage("Cambios guardados correctamente.");
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Error al guardar los cambios");
    } finally {
      setSaving(false);
    }
  }

  function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setSaveError("Selecciona un archivo de imagen.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setSaveError("La imagen no puede superar 5 MB.");
      return;
    }

    setAvatarFile(file);
    setAvatarPreviewUrl((currentUrl) => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      return URL.createObjectURL(file);
    });
    setSaveError("");
    setSaveMessage("");
  }

  return (
    <div className="bg-page min-h-screen">
      <section className="border-border-main bg-surface border-b">
        <div className="mx-auto flex max-w-340 flex-col gap-6 px-6 py-10 md:flex-row md:items-center md:px-10">
          <div className="relative shrink-0">
            {displayAvatarUrl ? (
              <img
                src={displayAvatarUrl}
                alt={fullName}
                className="avatar-hero bg-primary-light"
              />
            ) : (
              <div className="profile-avatar-hero">{initials}</div>
            )}
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
            <button
              type="button"
              className="bg-primary absolute right-2 bottom-2 flex size-7 items-center justify-center rounded-full p-0 text-white"
              aria-label="Cambiar foto de perfil"
              onClick={() => avatarInputRef.current?.click()}
            >
              <Camera size={15} />
            </button>
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="text-profile-name font-bold">{fullName || "Mi perfil"}</h1>
            {profileMeta && <p className="profile-meta mt-1">{profileMeta}</p>}
            {!reviewsState.loading && reviewsState.total > 0 && (
              <p className="text-rating mt-1 flex items-center gap-1 text-[13px]">
                <Star
                  size={13}
                  fill="currentColor"
                />
                {reviewsState.average.toFixed(1)} - {reviewsState.total} valoraciones
              </p>
            )}

            <div className="mt-4 grid max-w-180 grid-cols-1 gap-3 sm:grid-cols-3">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="border-border-main flex h-10 items-center gap-3 rounded-lg border bg-white px-4"
                >
                  <p className="profile-stat-value text-[18px]">{stat.value}</p>
                  <p className="profile-stat-label">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-196 px-6 py-10 lg:px-10">
        <form
          className="space-y-7"
          onSubmit={handleSubmit}
        >
          <section>
            <h2 className="heading-panel">Informacion personal</h2>
            <p className="text-subtle mt-1">Actualiza tus datos personales y como te ven otros usuarios</p>

            <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
              <label className="mb-0">
                Nombre
                <input
                  type="text"
                  className="mt-1"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  autoComplete="given-name"
                />
              </label>
              <label className="mb-0">
                Apellidos
                <input
                  type="text"
                  className="mt-1"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  autoComplete="family-name"
                />
              </label>
            </div>

            <label className="mt-5 mb-0">
              Nuevo email
              <input
                type="email"
                className="mt-1"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
              />
            </label>

            <label className="mt-5 mb-0">
              Confirmar email
              <input
                type="email"
                className="mt-1"
                value={confirmEmail}
                onChange={(event) => setConfirmEmail(event.target.value)}
                autoComplete="email"
              />
            </label>

            <label className="mt-5 mb-0">
              Ubicacion
              <input
                type="text"
                className="mt-1"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="Ciudad, pais"
              />
            </label>

            <label className="mt-5 mb-0">
              Telefono
              <input
                type="tel"
                className="mt-1"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                autoComplete="tel"
              />
            </label>
          </section>

          <hr className="divider-subtle" />

          <section>
            <h2 className="heading-panel--sm">Cambiar contrasena</h2>
            <label className="mt-4 mb-0">
              Contrasena actual
              <input
                className="mt-1 [-webkit-text-security:disc]"
                type="text"
                name="profile-current-secret"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
            </label>
            <label className="mt-4 mb-0">
              Nueva contrasena
              <input
                className="mt-1 [-webkit-text-security:disc]"
                type="text"
                name="profile-new-secret"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
            </label>
            <label className="mt-4 mb-0">
              Confirmar nueva contrasena
              <input
                className="mt-1 [-webkit-text-security:disc]"
                type="text"
                name="profile-confirm-secret"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
            </label>
          </section>

          <hr className="divider-subtle" />

          <section>
            <h2 className="heading-panel--sm">Zona de peligro</h2>
            <div className="border-report bg-error-danger mt-4 flex flex-col gap-4 rounded-xl border p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-report font-medium">Eliminar cuenta</p>
                <p className="text-subtle mt-2 text-[13px]">Esta accion es irreversible. Se eliminaran tus datos y publicaciones.</p>
              </div>
              <button
                type="button"
                className="btn-danger-outline btn--sm"
              >
                <Trash2 size={14} />
                Eliminar cuenta
              </button>
            </div>
          </section>

          {saveError && <p className="border-report bg-error-danger text-report rounded-lg border p-3">{saveError}</p>}
          {saveMessage && <p className="border-primary-border bg-primary-light text-primary rounded-lg border p-3">{saveMessage}</p>}

          <button
            type="submit"
            className="btn-primary btn--lg w-full"
            disabled={saving}
          >
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </form>
      </main>
    </div>
  );
}

export { ProfileEdit };
