import { useEffect, useMemo, useReducer, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Camera, MapPin, Pencil, Plus, Star, Trash2, X } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import type { AddressResponse, CreateAddressRequest } from "@/types/address";
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

const EMPTY_ADDRESS: CreateAddressRequest = {
  street: "",
  number: "",
  floor: "",
  city: "",
  province: "",
  postal_code: "",
  country: "Spain",
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

async function fetchAddresses(signal: AbortSignal): Promise<AddressResponse[]> {
  const res = await fetch("/api/addresses", {
    credentials: "include",
    signal,
  });
  const json = (await res.json()) as ApiResponse<AddressResponse[]>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message ?? json.error ?? "Error al cargar tus direcciónes");
  }
  return json.data;
}

async function createAddress(payload: CreateAddressRequest): Promise<AddressResponse> {
  const res = await fetch("/api/addresses", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const json = (await res.json()) as ApiResponse<AddressResponse>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message ?? json.error ?? "Error al guardar la dirección");
  }
  return json.data;
}

async function updateAddress(addressId: string, payload: CreateAddressRequest): Promise<AddressResponse> {
  const res = await fetch(`/api/addresses/${addressId}`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const json = (await res.json()) as ApiResponse<AddressResponse>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message ?? json.error ?? "Error al actualizar la dirección");
  }
  return json.data;
}

async function deleteAddress(addressId: string): Promise<void> {
  const res = await fetch(`/api/addresses/${addressId}`, {
    method: "DELETE",
    credentials: "include",
  });
  const json = (await res.json()) as ApiResponse<{ message: string }>;
  if (!res.ok || !json.success) {
    throw new Error(json.message ?? json.error ?? "Error al quitar la dirección");
  }
}

async function deleteAccount(): Promise<void> {
  const res = await fetch("/api/me", {
    method: "DELETE",
    credentials: "include",
  });
  const json = (await res.json()) as ApiResponse<{ message: string }>;
  if (!res.ok || !json.success) {
    throw new Error(json.message ?? json.error ?? "Error al eliminar la cuenta");
  }
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
    throw new Error(json.message ?? json.error ?? "Error al cambiar la contraseña");
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

function addressToDraft(address: AddressResponse): CreateAddressRequest {
  return {
    street: address.street,
    number: address.number,
    floor: address.floor ?? "",
    city: address.city,
    province: address.province,
    postal_code: address.postal_code,
    country: address.country || "Spain",
    latitude: address.latitude,
    longitude: address.longitude,
  };
}

function formatAddress(address: AddressResponse) {
  return `${address.street} ${address.number}${address.floor ? `, ${address.floor}` : ""}`;
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
  const [addresses, setAddresses] = useState<AddressResponse[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(true);
  const [addressesError, setAddressesError] = useState("");
  const [showAddressEditor, setShowAddressEditor] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addressDraft, setAddressDraft] = useState<CreateAddressRequest>(EMPTY_ADDRESS);
  const [addressErrors, setAddressErrors] = useState<Partial<CreateAddressRequest>>({});
  const [savingAddress, setSavingAddress] = useState(false);
  const [deletingAddressId, setDeletingAddressId] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
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

    setAddressesLoading(true);
    fetchAddresses(controller.signal)
      .then((data) => {
        setAddresses(data);
        setAddressesError("");
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setAddressesError(err instanceof Error ? err.message : "Error al cargar tus direcciónes");
      })
      .finally(() => {
        if (!controller.signal.aborted) setAddressesLoading(false);
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
      setSaveError("El email y su confirmación no coinciden.");
      return;
    }

    if (newPassword || confirmPassword || currentPassword) {
      if (!currentPassword || !newPassword || !confirmPassword) {
        setSaveError("Completa todos los campos de contraseña para cambiarla.");
        return;
      }
      if (newPassword !== confirmPassword) {
        setSaveError("La nueva contraseña y su confirmación no coinciden.");
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

  function handleAddressFieldChange(event: ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;
    setAddressDraft((current) => ({ ...current, [name]: value }));
    setAddressErrors((current) => ({ ...current, [name]: undefined }));
  }

  function validateAddressDraft() {
    const errors: Partial<CreateAddressRequest> = {};
    if (!addressDraft.street.trim()) errors.street = "Obligatorio";
    if (!addressDraft.number.trim()) errors.number = "Obligatorio";
    if (!addressDraft.city.trim()) errors.city = "Obligatorio";
    if (!addressDraft.province.trim()) errors.province = "Obligatorio";
    if (!addressDraft.postal_code.trim()) errors.postal_code = "Obligatorio";
    setAddressErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function openNewAddressEditor() {
    setEditingAddressId(null);
    setAddressDraft(EMPTY_ADDRESS);
    setAddressErrors({});
    setShowAddressEditor(true);
  }

  function openEditAddressEditor(address: AddressResponse) {
    setEditingAddressId(address.address_id);
    setAddressDraft(addressToDraft(address));
    setAddressErrors({});
    setShowAddressEditor(true);
  }

  async function handleSaveAddress() {
    if (!validateAddressDraft()) return;

    setSavingAddress(true);
    setAddressesError("");
    try {
      const payload = {
        ...addressDraft,
        floor: addressDraft.floor?.trim() ?? "",
        country: addressDraft.country ?? "Spain",
      };

      if (editingAddressId) {
        const updated = await updateAddress(editingAddressId, payload);
        setAddresses((current) =>
          current.map((address) => (address.address_id === updated.address_id ? updated : address))
        );
      } else {
        const created = await createAddress(payload);
        setAddresses((current) => [...current, created]);
      }

      setAddressDraft(EMPTY_ADDRESS);
      setEditingAddressId(null);
      setShowAddressEditor(false);
      setSaveMessage(editingAddressId ? "dirección actualizada correctamente." : "dirección guardada correctamente.");
    } catch (err: unknown) {
      setAddressesError(err instanceof Error ? err.message : "Error al guardar la dirección");
    } finally {
      setSavingAddress(false);
    }
  }

  async function handleDeleteAddress(addressId: string) {
    setDeletingAddressId(addressId);
    setAddressesError("");
    try {
      await deleteAddress(addressId);
      setAddresses((current) => current.filter((address) => address.address_id !== addressId));
      if (editingAddressId === addressId) {
        setEditingAddressId(null);
        setShowAddressEditor(false);
        setAddressDraft(EMPTY_ADDRESS);
      }
      setSaveMessage("dirección quitada correctamente.");
    } catch (err: unknown) {
      setAddressesError(err instanceof Error ? err.message : "Error al quitar la dirección");
    } finally {
      setDeletingAddressId(null);
    }
  }

  async function handleDeleteAccount() {
    setDeletingAccount(true);
    setSaveError("");
    try {
      await deleteAccount();
      window.location.href = "/";
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Error al eliminar la cuenta");
      setShowDeleteConfirm(false);
      setDeletingAccount(false);
    }
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
                  <p className="profile-stat-value text-logo-footer">{stat.value}</p>
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
                placeholder={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
              />
            </label>

            <label className="mt-5 mb-0">
              Confirmar email
              <input
                type="email"
                className="mt-1"
                placeholder={confirmEmail}
                onChange={(event) => setConfirmEmail(event.target.value)}
                autoComplete="email"
              />
            </label>

            <label className="mt-5 mb-0">
              Teléfono
              <input
                type="tel"
                className="mt-1"
                placeholder={phone}
                onChange={(event) => setPhone(event.target.value)}
                autoComplete="tel"
              />
            </label>
          </section>

          <hr className="divider-subtle" />

          <section>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="heading-panel--sm">direcciónes</h2>
                <p className="text-subtle mt-1 text-[13px]">Gestiona tus direcciónes de recogida.</p>
              </div>
              <button
                type="button"
                className="text-primary flex items-center gap-1.5 px-0 font-medium"
                onClick={openNewAddressEditor}
              >
                <Plus size={16} />
                Nueva dirección
              </button>
            </div>

            {addressesError && (
              <p className="border-report bg-error-danger text-report mt-4 rounded-lg border p-3">{addressesError}</p>
            )}

            <div className="mt-5 space-y-3">
              {addressesLoading ? (
                <p className="text-subtle">Cargando direcciónes...</p>
              ) : addresses.length === 0 ? (
                <p className="border-border-main text-subtle rounded-lg border bg-white p-4">
                  Todavia no tienes direcciónes guardadas.
                </p>
              ) : (
                addresses.map((address) => (
                  <div
                    key={address.address_id}
                    className="border-border-main flex flex-col gap-3 rounded-lg border bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="bg-primary-light text-primary flex size-9 shrink-0 items-center justify-center rounded-full">
                        <MapPin size={16} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-ink font-medium">{formatAddress(address)}</p>
                        <p className="text-subtle text-[13px]">
                          {address.postal_code} - {address.city}, {address.province}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 self-start sm:self-center">
                      <button
                        type="button"
                        className="btn-secondary btn--sm"
                        onClick={() => openEditAddressEditor(address)}
                      >
                        <Pencil size={14} />
                        Editar
                      </button>
                      <button
                        type="button"
                        className="btn-danger-outline btn--sm"
                        onClick={() => void handleDeleteAddress(address.address_id)}
                        disabled={deletingAddressId === address.address_id}
                      >
                        <Trash2 size={14} />
                        {deletingAddressId === address.address_id ? "Quitando..." : "Quitar"}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {showAddressEditor && (
              <div className="border-border-main mt-5 rounded-xl border bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-ink font-semibold">
                    {editingAddressId ? "Editar dirección" : "Añadir dirección"}
                  </h3>
                  <button
                    type="button"
                    className="text-subtle hover:text-ink p-0"
                    aria-label="Cerrar editor de dirección"
                    onClick={() => {
                      setShowAddressEditor(false);
                      setAddressErrors({});
                    }}
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_100px]">
                  <label className="mb-0">
                    Calle / Avenida
                    <input
                      type="text"
                      name="street"
                      className={`mt-1 ${addressErrors.street ? "border-red-400" : ""}`}
                      value={addressDraft.street}
                      onChange={handleAddressFieldChange}
                      placeholder="Calle Gran Via"
                    />
                    {addressErrors.street && <p className="mt-1 text-xs text-red-500">{addressErrors.street}</p>}
                  </label>

                  <label className="mb-0">
                    Numero
                    <input
                      type="text"
                      name="number"
                      className={`mt-1 ${addressErrors.number ? "border-red-400" : ""}`}
                      value={addressDraft.number}
                      onChange={handleAddressFieldChange}
                      placeholder="12"
                    />
                    {addressErrors.number && <p className="mt-1 text-xs text-red-500">{addressErrors.number}</p>}
                  </label>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-[1fr_200px]">
                  <label className="mb-0">
                    Piso / Puerta <span className="text-subtle">(opcional)</span>
                    <input
                      type="text"
                      name="floor"
                      className="mt-1"
                      value={addressDraft.floor ?? ""}
                      onChange={handleAddressFieldChange}
                      placeholder="3ºA"
                    />
                  </label>

                  <label className="mb-0">
                    Codigo postal
                    <input
                      type="text"
                      name="postal_code"
                      className={`mt-1 ${addressErrors.postal_code ? "border-red-400" : ""}`}
                      value={addressDraft.postal_code}
                      onChange={handleAddressFieldChange}
                      placeholder="28013"
                    />
                    {addressErrors.postal_code && (
                      <p className="mt-1 text-xs text-red-500">{addressErrors.postal_code}</p>
                    )}
                  </label>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-[1fr_200px]">
                  <label className="mb-0">
                    Ciudad
                    <input
                      type="text"
                      name="city"
                      className={`mt-1 ${addressErrors.city ? "border-red-400" : ""}`}
                      value={addressDraft.city}
                      onChange={handleAddressFieldChange}
                      placeholder="Madrid"
                    />
                    {addressErrors.city && <p className="mt-1 text-xs text-red-500">{addressErrors.city}</p>}
                  </label>

                  <label className="mb-0">
                    Provincia
                    <input
                      type="text"
                      name="province"
                      className={`mt-1 ${addressErrors.province ? "border-red-400" : ""}`}
                      value={addressDraft.province}
                      onChange={handleAddressFieldChange}
                      placeholder="Madrid"
                    />
                    {addressErrors.province && <p className="mt-1 text-xs text-red-500">{addressErrors.province}</p>}
                  </label>
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    className="btn-primary btn--sm"
                    onClick={handleSaveAddress}
                    disabled={savingAddress}
                  >
                    {savingAddress ? "Guardando..." : "Guardar dirección"}
                  </button>
                </div>
              </div>
            )}
          </section>

          <hr className="divider-subtle" />

          <section>
            <h2 className="heading-panel--sm">Cambiar contraseña</h2>
            <label className="mt-4 mb-0">
              contraseña actual
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
              Nueva contraseña
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
              Confirmar nueva contraseña
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
                <p className="text-subtle mt-2 text-[13px]">
                  Esta accion es irreversible. Se eliminaran tus datos y publicaciones.
                </p>
              </div>
              <button
                type="button"
                className="btn-danger-outline btn--sm"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 size={14} />
                Eliminar cuenta
              </button>
            </div>
          </section>

          {saveError && <p className="border-report bg-error-danger text-report rounded-lg border p-3">{saveError}</p>}
          {saveMessage && (
            <p className="border-primary-border bg-primary-light text-primary rounded-lg border p-3">{saveMessage}</p>
          )}

          <button
            type="submit"
            className="btn-primary btn--lg w-full"
            disabled={saving}
          >
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </form>
      </main>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="border-border-main w-full max-w-md rounded-xl border bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="heading-panel--sm">Eliminar cuenta</h2>
                <p className="text-subtle mt-2 text-[13px]">
                  Se eliminara tu cuenta y todos los datos relacionados. Esta accion no se puede deshacer.
                </p>
              </div>
              <button
                type="button"
                className="text-subtle hover:text-ink p-0"
                aria-label="Cerrar confirmación"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deletingAccount}
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="btn-secondary btn--sm"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deletingAccount}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-danger-outline btn--sm"
                onClick={() => void handleDeleteAccount()}
                disabled={deletingAccount}
              >
                <Trash2 size={14} />
                {deletingAccount ? "Eliminando..." : "Confirmar eliminación"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { ProfileEdit };
