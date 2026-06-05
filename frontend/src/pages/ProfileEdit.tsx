import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type RefObject,
} from "react";
import { Camera, MapPin, Pencil, Plus, Star, Trash2, X } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import type { AddressResponse, CreateAddressRequest } from "@/types/address";
import type { ApiResponse } from "@/types/common";
import type { CustomerPublic } from "@/types/customer";
import {
  fetchMyItems,
  fetchReceivedReviews,
  formatMemberSince,
  getInitials,
  initialProductsState,
  productsReducer,
  uniqueProductCities,
  type ReceivedReviewsResponseBase,
} from "@/components/profile/profileShared";

// Reuse shared response shape for received reviews.
type ReceivedReviewsResponse = ReceivedReviewsResponseBase<unknown>;

interface ReviewsState {
  total: number;
  average: number;
  loading: boolean;
  error: string;
}

interface ProfileState {
  firstName: string;
  lastName: string;
  email: string;
  confirmEmail: string;
  phone: string;
  avatarUrl: string;
  avatarPreviewUrl: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  saveError: string;
  saveMessage: string;
}

interface AddressState {
  items: AddressResponse[];
  loading: boolean;
  error: string;
  showEditor: boolean;
  editingId: string | null;
  draft: CreateAddressRequest;
  fieldErrors: Partial<CreateAddressRequest>;
  saving: boolean;
  deletingId: string | null;
}

type ReviewsAction =
  | { type: "fetch_start" }
  | { type: "fetch_success"; payload: ReceivedReviewsResponse }
  | { type: "fetch_error"; error: string };

type ProfileAction =
  | { type: "hydrate_user"; payload: CustomerPublic }
  | { type: "set_field"; field: keyof ProfileState; value: string }
  | { type: "set_avatar_preview"; url: string }
  | { type: "clear_avatar_preview" }
  | { type: "set_save_error"; message: string }
  | { type: "set_save_message"; message: string }
  | { type: "reset_passwords" }
  | { type: "clear_messages" };

type AddressAction =
  | { type: "load_start" }
  | { type: "load_success"; payload: AddressResponse[] }
  | { type: "load_error"; error: string }
  | { type: "set_error"; error: string }
  | { type: "open_new" }
  | { type: "open_edit"; payload: AddressResponse }
  | { type: "close_editor" }
  | { type: "reset_draft" }
  | { type: "update_draft"; field: keyof CreateAddressRequest; value: string }
  | { type: "set_field_errors"; payload: Partial<CreateAddressRequest> }
  | { type: "save_start" }
  | { type: "save_end" }
  | { type: "set_deleting"; payload: string | null }
  | { type: "upsert"; payload: AddressResponse }
  | { type: "remove"; payload: string };

const initialReviewsState: ReviewsState = {
  total: 0,
  average: 0,
  loading: true,
  error: "",
};

function createEmptyAddress(): CreateAddressRequest {
  return {
    street: "",
    number: "",
    floor: "",
    city: "",
    province: "",
    postal_code: "",
    country: "Spain",
  };
}

const initialAddressState: AddressState = {
  items: [],
  loading: true,
  error: "",
  showEditor: false,
  editingId: null,
  draft: createEmptyAddress(),
  fieldErrors: {},
  saving: false,
  deletingId: null,
};

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

function createInitialProfileState(user?: CustomerPublic | null): ProfileState {
  return {
    firstName: user?.first_name ?? "",
    lastName: user?.last_name ?? "",
    email: user?.email ?? "",
    confirmEmail: user?.email ?? "",
    phone: user?.phone ?? "",
    avatarUrl: user?.avatar_url ?? "",
    avatarPreviewUrl: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
    saveError: "",
    saveMessage: "",
  };
}

function profileReducer(state: ProfileState, action: ProfileAction): ProfileState {
  switch (action.type) {
    case "hydrate_user":
      return {
        ...state,
        firstName: action.payload.first_name,
        lastName: action.payload.last_name,
        email: action.payload.email,
        confirmEmail: action.payload.email,
        phone: action.payload.phone ?? "",
        avatarUrl: action.payload.avatar_url ?? "",
        avatarPreviewUrl: "",
        saveError: "",
        saveMessage: "",
      };
    case "set_field":
      return { ...state, [action.field]: action.value };
    case "set_avatar_preview":
      return { ...state, avatarPreviewUrl: action.url };
    case "clear_avatar_preview":
      return { ...state, avatarPreviewUrl: "" };
    case "set_save_error":
      return { ...state, saveError: action.message };
    case "set_save_message":
      return { ...state, saveMessage: action.message };
    case "reset_passwords":
      return { ...state, currentPassword: "", newPassword: "", confirmPassword: "" };
    case "clear_messages":
      return { ...state, saveError: "", saveMessage: "" };
    default:
      return state;
  }
}

function addressReducer(state: AddressState, action: AddressAction): AddressState {
  switch (action.type) {
    case "load_start":
      return { ...state, loading: true, error: "" };
    case "load_success":
      return { ...state, items: action.payload, loading: false, error: "" };
    case "load_error":
      return { ...state, loading: false, error: action.error };
    case "set_error":
      return { ...state, error: action.error };
    case "open_new":
      return { ...state, showEditor: true, editingId: null, draft: createEmptyAddress(), fieldErrors: {} };
    case "open_edit":
      return {
        ...state,
        showEditor: true,
        editingId: action.payload.address_id,
        draft: addressToDraft(action.payload),
        fieldErrors: {},
      };
    case "close_editor":
      return { ...state, showEditor: false, fieldErrors: {} };
    case "reset_draft":
      return { ...state, editingId: null, draft: createEmptyAddress(), fieldErrors: {} };
    case "update_draft":
      return {
        ...state,
        draft: { ...state.draft, [action.field]: action.value },
        fieldErrors: { ...state.fieldErrors, [action.field]: undefined },
      };
    case "set_field_errors":
      return { ...state, fieldErrors: action.payload };
    case "save_start":
      return { ...state, saving: true };
    case "save_end":
      return { ...state, saving: false };
    case "set_deleting":
      return { ...state, deletingId: action.payload };
    case "upsert": {
      const existing = state.items.some((item) => item.address_id === action.payload.address_id);
      return {
        ...state,
        items: existing
          ? state.items.map((item) => (item.address_id === action.payload.address_id ? action.payload : item))
          : [...state.items, action.payload],
      };
    }
    case "remove":
      return { ...state, items: state.items.filter((item) => item.address_id !== action.payload) };
    default:
      return state;
  }
}

async function fetchAddresses(signal: AbortSignal): Promise<AddressResponse[]> {
  const res = await fetch("/api/addresses", {
    credentials: "include",
    signal,
  });
  const json = (await res.json()) as ApiResponse<AddressResponse[]>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message ?? json.error ?? "Error al cargar tus direcciones");
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

function validateAddressDraft(draft: CreateAddressRequest) {
  const errors: Partial<CreateAddressRequest> = {};
  if (!draft.street.trim()) errors.street = "Obligatorio";
  if (!draft.number.trim()) errors.number = "Obligatorio";
  if (!draft.city.trim()) errors.city = "Obligatorio";
  if (!draft.province.trim()) errors.province = "Obligatorio";
  if (!draft.postal_code.trim()) errors.postal_code = "Obligatorio";
  return errors;
}

interface StatItem {
  value: string | number;
  label: string;
}

interface ProfileHeaderProps {
  displayAvatarUrl: string;
  fullName: string;
  initials: string;
  profileMeta: string;
  reviewsState: ReviewsState;
  stats: StatItem[];
  avatarInputRef: RefObject<HTMLInputElement | null>;
  onAvatarChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onAvatarClick: () => void;
}

function ProfileHeader({
  displayAvatarUrl,
  fullName,
  initials,
  profileMeta,
  reviewsState,
  stats,
  avatarInputRef,
  onAvatarChange,
  onAvatarClick,
}: ProfileHeaderProps) {
  return (
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
            aria-label="Seleccionar foto de perfil"
            onChange={onAvatarChange}
          />
          <button
            type="button"
            className="bg-primary absolute right-2 bottom-2 flex size-7 items-center justify-center rounded-full p-0 text-white"
            aria-label="Cambiar foto de perfil"
            onClick={onAvatarClick}
          >
            <Camera size={15} />
          </button>
        </div>

        <div className="min-w-0 flex-1">
          <h1 className="text-profile-name font-semibold">{fullName || "Mi perfil"}</h1>
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
  );
}

interface PersonalInfoSectionProps {
  firstName: string;
  lastName: string;
  email: string;
  confirmEmail: string;
  phone: string;
  onFirstNameChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onLastNameChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onEmailChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onConfirmEmailChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onPhoneChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

function PersonalInfoSection({
  firstName,
  lastName,
  email,
  confirmEmail,
  phone,
  onFirstNameChange,
  onLastNameChange,
  onEmailChange,
  onConfirmEmailChange,
  onPhoneChange,
}: PersonalInfoSectionProps) {
  return (
    <section>
      <h2 className="heading-panel">Información personal</h2>
      <p className="text-subtle mt-1">Actualiza tus datos personales y como te ven otros usuarios</p>

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <label className="mb-0">
          Nombre
          <input
            type="text"
            className="mt-1"
            value={firstName}
            onChange={onFirstNameChange}
            autoComplete="given-name"
          />
        </label>
        <label className="mb-0">
          Apellidos
          <input
            type="text"
            className="mt-1"
            value={lastName}
            onChange={onLastNameChange}
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
          onChange={onEmailChange}
          autoComplete="email"
        />
      </label>

      <label className="mt-5 mb-0">
        Confirmar email
        <input
          type="email"
          className="mt-1"
          placeholder={confirmEmail}
          onChange={onConfirmEmailChange}
          autoComplete="email"
        />
      </label>

      <label className="mt-5 mb-0">
        Teléfono
        <input
          type="tel"
          className="mt-1"
          placeholder={phone}
          onChange={onPhoneChange}
          autoComplete="tel"
        />
      </label>
    </section>
  );
}

interface AddressesSectionProps {
  state: AddressState;
  onOpenNew: () => void;
  onOpenEdit: (address: AddressResponse) => void;
  onCloseEditor: () => void;
  onFieldChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onSave: () => void;
  onDelete: (addressId: string) => void;
}

function AddressesSection({
  state,
  onOpenNew,
  onOpenEdit,
  onCloseEditor,
  onFieldChange,
  onSave,
  onDelete,
}: AddressesSectionProps) {
  return (
    <section>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="heading-panel--sm">Direcciones</h2>
          <p className="text-subtle mt-1 text-[13px]">Gestiona tus direcciones de recogida.</p>
        </div>
        <button
          type="button"
          className="text-primary flex items-center gap-1.5 px-0 font-medium"
          onClick={onOpenNew}
        >
          <Plus size={16} />
          Nueva dirección
        </button>
      </div>

      {state.error && (
        <p className="border-report bg-error-danger text-report mt-4 rounded-lg border p-3">{state.error}</p>
      )}

      <div className="mt-5 space-y-3">
        {state.loading ? (
          <p className="text-subtle">Cargando direcciones…</p>
        ) : state.items.length === 0 ? (
          <p className="border-border-main text-subtle rounded-lg border bg-white p-4">
            Todavía no tienes direcciones guardadas.
          </p>
        ) : (
          state.items.map((address) => (
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
                  onClick={() => onOpenEdit(address)}
                >
                  <Pencil size={14} />
                  Editar
                </button>
                <button
                  type="button"
                  className="btn-danger-outline btn--sm"
                  onClick={() => onDelete(address.address_id)}
                  disabled={state.deletingId === address.address_id}
                >
                  <Trash2 size={14} />
                  {state.deletingId === address.address_id ? "Quitando…" : "Quitar"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {state.showEditor && (
        <div className="border-border-main mt-5 rounded-xl border bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-ink font-semibold">{state.editingId ? "Editar dirección" : "Añadir dirección"}</h3>
            <button
              type="button"
              className="text-subtle hover:text-ink p-0"
              aria-label="Cerrar editor de dirección"
              onClick={onCloseEditor}
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
                className={`mt-1 ${state.fieldErrors.street ? "border-red-400" : ""}`}
                value={state.draft.street}
                onChange={onFieldChange}
                placeholder="Calle Gran Vía"
              />
              {state.fieldErrors.street && <p className="mt-1 text-xs text-red-500">{state.fieldErrors.street}</p>}
            </label>

            <label className="mb-0">
              Número
              <input
                type="text"
                name="number"
                className={`mt-1 ${state.fieldErrors.number ? "border-red-400" : ""}`}
                value={state.draft.number}
                onChange={onFieldChange}
                placeholder="12"
              />
              {state.fieldErrors.number && <p className="mt-1 text-xs text-red-500">{state.fieldErrors.number}</p>}
            </label>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-[1fr_200px]">
            <label className="mb-0">
              Piso / Puerta <span className="text-subtle">(opcional)</span>
              <input
                type="text"
                name="floor"
                className="mt-1"
                value={state.draft.floor ?? ""}
                onChange={onFieldChange}
                placeholder="3ºA"
              />
            </label>

            <label className="mb-0">
              Código postal
              <input
                type="text"
                name="postal_code"
                className={`mt-1 ${state.fieldErrors.postal_code ? "border-red-400" : ""}`}
                value={state.draft.postal_code}
                onChange={onFieldChange}
                placeholder="28013"
              />
              {state.fieldErrors.postal_code && (
                <p className="mt-1 text-xs text-red-500">{state.fieldErrors.postal_code}</p>
              )}
            </label>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-[1fr_200px]">
            <label className="mb-0">
              Ciudad
              <input
                type="text"
                name="city"
                className={`mt-1 ${state.fieldErrors.city ? "border-red-400" : ""}`}
                value={state.draft.city}
                onChange={onFieldChange}
                placeholder="Madrid"
              />
              {state.fieldErrors.city && <p className="mt-1 text-xs text-red-500">{state.fieldErrors.city}</p>}
            </label>

            <label className="mb-0">
              Provincia
              <input
                type="text"
                name="province"
                className={`mt-1 ${state.fieldErrors.province ? "border-red-400" : ""}`}
                value={state.draft.province}
                onChange={onFieldChange}
                placeholder="Madrid"
              />
              {state.fieldErrors.province && <p className="mt-1 text-xs text-red-500">{state.fieldErrors.province}</p>}
            </label>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              className="btn-primary btn--sm"
              onClick={onSave}
              disabled={state.saving}
            >
              {state.saving ? "Guardando…" : "Guardar dirección"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

interface PasswordSectionProps {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  onCurrentPasswordChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onNewPasswordChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onConfirmPasswordChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

function PasswordSection({
  currentPassword,
  newPassword,
  confirmPassword,
  onCurrentPasswordChange,
  onNewPasswordChange,
  onConfirmPasswordChange,
}: PasswordSectionProps) {
  return (
    <section>
      <h2 className="heading-panel--sm">Cambiar contraseña</h2>
      <label className="mt-4 mb-0">
        Contraseña actual
        <input
          className="mt-1 [-webkit-text-security:disc]"
          type="text"
          name="profile-current-secret"
          value={currentPassword}
          onChange={onCurrentPasswordChange}
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
          onChange={onNewPasswordChange}
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
          onChange={onConfirmPasswordChange}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
      </label>
    </section>
  );
}

interface DangerZoneSectionProps {
  onDeleteClick: () => void;
}

function DangerZoneSection({ onDeleteClick }: DangerZoneSectionProps) {
  return (
    <section>
      <h2 className="heading-panel--sm">Zona de peligro</h2>
      <div className="border-report bg-error-danger mt-4 flex flex-col gap-4 rounded-xl border p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-report font-medium">Eliminar cuenta</p>
          <p className="text-subtle mt-2 text-[13px]">
            Esta acción es irreversible. Se eliminarán tus datos y publicaciones.
          </p>
        </div>
        <button
          type="button"
          className="btn-danger-outline btn--sm"
          onClick={onDeleteClick}
        >
          <Trash2 size={14} />
          Eliminar cuenta
        </button>
      </div>
    </section>
  );
}

interface SaveActionsProps {
  saveError: string;
  saveMessage: string;
  saving: boolean;
}

function SaveActions({ saveError, saveMessage, saving }: SaveActionsProps) {
  return (
    <>
      {saveError && <p className="border-report bg-error-danger text-report rounded-lg border p-3">{saveError}</p>}
      {saveMessage && (
        <p className="border-primary-border bg-primary-light text-primary rounded-lg border p-3">{saveMessage}</p>
      )}

      <button
        type="submit"
        className="btn-primary btn--lg w-full"
        disabled={saving}
      >
        {saving ? "Guardando…" : "Guardar cambios"}
      </button>
    </>
  );
}

interface DeleteConfirmModalProps {
  deletingAccount: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

function DeleteConfirmModal({ deletingAccount, onClose, onConfirm }: DeleteConfirmModalProps) {
  return (
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
            onClick={onClose}
            disabled={deletingAccount}
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="btn-secondary btn--sm"
            onClick={onClose}
            disabled={deletingAccount}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn-danger-outline btn--sm"
            onClick={onConfirm}
            disabled={deletingAccount}
          >
            <Trash2 size={14} />
            {deletingAccount ? "Eliminando…" : "Confirmar eliminación"}
          </button>
        </div>
      </div>
    </div>
  );
}

function useProfileEditState() {
  const { user } = useAuth();
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const avatarFileRef = useRef<File | null>(null);
  const [productsState, dispatchProducts] = useReducer(productsReducer, initialProductsState);
  const [reviewsState, dispatchReviews] = useReducer(reviewsReducer, initialReviewsState);
  const [profileState, dispatchProfile] = useReducer(profileReducer, user, createInitialProfileState);
  const [addressState, dispatchAddress] = useReducer(addressReducer, initialAddressState);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  useEffect(() => {
    if (!user) return;
    dispatchProfile({ type: "hydrate_user", payload: user });
    avatarFileRef.current = null;
  }, [user]);

  useEffect(() => {
    return () => {
      if (profileState.avatarPreviewUrl) URL.revokeObjectURL(profileState.avatarPreviewUrl);
    };
  }, [profileState.avatarPreviewUrl]);

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

    dispatchAddress({ type: "load_start" });
    fetchAddresses(controller.signal)
      .then((data) => {
        dispatchAddress({ type: "load_success", payload: data });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        dispatchAddress({
          type: "load_error",
          error: err instanceof Error ? err.message : "Error al cargar tus direcciones",
        });
      });

    return () => controller.abort();
  }, []);

  const fullName = `${profileState.firstName} ${profileState.lastName}`.trim();
  const initials = getInitials(profileState.firstName, profileState.lastName);
  const displayAvatarUrl = profileState.avatarPreviewUrl || profileState.avatarUrl;
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
      { value: productsState.loading ? "…" : activeProducts, label: "Productos" },
      { value: productsState.loading ? "…" : rentedProducts, label: "Reservados" },
      { value: reviewsState.loading ? "…" : reviewsState.total, label: "Valoraciones" },
    ],
    [activeProducts, rentedProducts, productsState.loading, reviewsState.loading, reviewsState.total]
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    dispatchProfile({ type: "clear_messages" });

    const nextEmail = profileState.email.trim();
    const nextConfirmEmail = profileState.confirmEmail.trim();
    const emailChanged = nextEmail.toLowerCase() !== (user?.email ?? "").toLowerCase();

    if (emailChanged && nextEmail.toLowerCase() !== nextConfirmEmail.toLowerCase()) {
      dispatchProfile({ type: "set_save_error", message: "El email y su confirmación no coinciden." });
      return;
    }

    if (profileState.newPassword || profileState.confirmPassword || profileState.currentPassword) {
      if (!profileState.currentPassword || !profileState.newPassword || !profileState.confirmPassword) {
        dispatchProfile({
          type: "set_save_error",
          message: "Completa todos los campos de contraseña para cambiarla.",
        });
        return;
      }
      if (profileState.newPassword !== profileState.confirmPassword) {
        dispatchProfile({
          type: "set_save_error",
          message: "La nueva contraseña y su confirmación no coinciden.",
        });
        return;
      }
    }

    setSaving(true);
    try {
      if (profileState.newPassword || profileState.confirmPassword || profileState.currentPassword) {
        await updatePassword({
          current_password: profileState.currentPassword,
          new_password: profileState.newPassword,
          confirm_new_password: profileState.confirmPassword,
        });
        dispatchProfile({ type: "reset_passwords" });
      }

      if (emailChanged) {
        await updateEmail({
          email: nextEmail,
          confirm_email: nextConfirmEmail,
        });
      }
      await updateProfile({
        first_name: profileState.firstName.trim(),
        last_name: profileState.lastName.trim(),
        phone: profileState.phone.trim() || null,
        avatar_url: profileState.avatarUrl.trim() || null,
      });

      if (avatarFileRef.current) {
        const updated = await uploadAvatar(avatarFileRef.current);
        dispatchProfile({ type: "set_field", field: "avatarUrl", value: updated.avatar_url ?? "" });
        dispatchProfile({ type: "clear_avatar_preview" });
        avatarFileRef.current = null;
      }

      dispatchProfile({ type: "set_save_message", message: "Cambios guardados correctamente." });
    } catch (err: unknown) {
      dispatchProfile({
        type: "set_save_error",
        message: err instanceof Error ? err.message : "Error al guardar los cambios",
      });
    } finally {
      setSaving(false);
    }
  }

  function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      dispatchProfile({ type: "set_save_error", message: "Selecciona un archivo de imagen." });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      dispatchProfile({ type: "set_save_error", message: "La imagen no puede superar 5 MB." });
      return;
    }

    avatarFileRef.current = file;
    if (profileState.avatarPreviewUrl) URL.revokeObjectURL(profileState.avatarPreviewUrl);
    dispatchProfile({ type: "set_avatar_preview", url: URL.createObjectURL(file) });
    dispatchProfile({ type: "clear_messages" });
  }

  function handleAddressFieldChange(event: ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;
    dispatchAddress({ type: "update_draft", field: name as keyof CreateAddressRequest, value });
  }

  function openNewAddressEditor() {
    dispatchAddress({ type: "open_new" });
  }

  function openEditAddressEditor(address: AddressResponse) {
    dispatchAddress({ type: "open_edit", payload: address });
  }

  function closeAddressEditor() {
    dispatchAddress({ type: "close_editor" });
  }

  async function handleSaveAddress() {
    const validationErrors = validateAddressDraft(addressState.draft);
    dispatchAddress({ type: "set_field_errors", payload: validationErrors });
    if (Object.keys(validationErrors).length > 0) return;

    dispatchAddress({ type: "save_start" });
    dispatchAddress({ type: "set_error", error: "" });
    try {
      const payload = {
        ...addressState.draft,
        floor: addressState.draft.floor?.trim() ?? "",
        country: addressState.draft.country ?? "Spain",
      };

      if (addressState.editingId) {
        const updated = await updateAddress(addressState.editingId, payload);
        dispatchAddress({ type: "upsert", payload: updated });
      } else {
        const created = await createAddress(payload);
        dispatchAddress({ type: "upsert", payload: created });
      }

      dispatchAddress({ type: "close_editor" });
      dispatchAddress({ type: "reset_draft" });
      dispatchProfile({
        type: "set_save_message",
        message: addressState.editingId ? "dirección actualizada correctamente." : "dirección guardada correctamente.",
      });
    } catch (err: unknown) {
      dispatchAddress({
        type: "set_error",
        error: err instanceof Error ? err.message : "Error al guardar la dirección",
      });
    } finally {
      dispatchAddress({ type: "save_end" });
    }
  }

  async function handleDeleteAddress(addressId: string) {
    dispatchAddress({ type: "set_deleting", payload: addressId });
    dispatchAddress({ type: "set_error", error: "" });
    try {
      await deleteAddress(addressId);
      dispatchAddress({ type: "remove", payload: addressId });
      if (addressState.editingId === addressId) {
        dispatchAddress({ type: "close_editor" });
        dispatchAddress({ type: "reset_draft" });
      }
      dispatchProfile({ type: "set_save_message", message: "dirección quitada correctamente." });
    } catch (err: unknown) {
      dispatchAddress({
        type: "set_error",
        error: err instanceof Error ? err.message : "Error al quitar la dirección",
      });
    } finally {
      dispatchAddress({ type: "set_deleting", payload: null });
    }
  }

  async function handleDeleteAccount() {
    setDeletingAccount(true);
    dispatchProfile({ type: "set_save_error", message: "" });
    try {
      await deleteAccount();
      window.location.href = "/";
    } catch (err: unknown) {
      dispatchProfile({
        type: "set_save_error",
        message: err instanceof Error ? err.message : "Error al eliminar la cuenta",
      });
      setShowDeleteConfirm(false);
      setDeletingAccount(false);
    }
  }

  return {
    avatarInputRef,
    profileState,
    addressState,
    reviewsState,
    saving,
    showDeleteConfirm,
    deletingAccount,
    stats,
    displayAvatarUrl,
    fullName,
    initials,
    profileMeta,
    onAvatarClick: () => avatarInputRef.current?.click(),
    onAvatarChange: handleAvatarChange,
    onSubmit: handleSubmit,
    onFirstNameChange: (event: ChangeEvent<HTMLInputElement>) =>
      dispatchProfile({ type: "set_field", field: "firstName", value: event.target.value }),
    onLastNameChange: (event: ChangeEvent<HTMLInputElement>) =>
      dispatchProfile({ type: "set_field", field: "lastName", value: event.target.value }),
    onEmailChange: (event: ChangeEvent<HTMLInputElement>) =>
      dispatchProfile({ type: "set_field", field: "email", value: event.target.value }),
    onConfirmEmailChange: (event: ChangeEvent<HTMLInputElement>) =>
      dispatchProfile({ type: "set_field", field: "confirmEmail", value: event.target.value }),
    onPhoneChange: (event: ChangeEvent<HTMLInputElement>) =>
      dispatchProfile({ type: "set_field", field: "phone", value: event.target.value }),
    onCurrentPasswordChange: (event: ChangeEvent<HTMLInputElement>) =>
      dispatchProfile({ type: "set_field", field: "currentPassword", value: event.target.value }),
    onNewPasswordChange: (event: ChangeEvent<HTMLInputElement>) =>
      dispatchProfile({ type: "set_field", field: "newPassword", value: event.target.value }),
    onConfirmPasswordChange: (event: ChangeEvent<HTMLInputElement>) =>
      dispatchProfile({ type: "set_field", field: "confirmPassword", value: event.target.value }),
    onOpenNewAddress: openNewAddressEditor,
    onOpenEditAddress: openEditAddressEditor,
    onCloseAddressEditor: closeAddressEditor,
    onAddressFieldChange: handleAddressFieldChange,
    onSaveAddress: handleSaveAddress,
    onDeleteAddress: handleDeleteAddress,
    onOpenDeleteConfirm: () => setShowDeleteConfirm(true),
    onCloseDeleteConfirm: () => setShowDeleteConfirm(false),
    onConfirmDeleteAccount: handleDeleteAccount,
  };
}

/**
 * Form page for updating the current user's profile.
 * @returns The profile edit page.
 */
function ProfileEdit() {
  const {
    avatarInputRef,
    profileState,
    addressState,
    reviewsState,
    saving,
    showDeleteConfirm,
    deletingAccount,
    stats,
    displayAvatarUrl,
    fullName,
    initials,
    profileMeta,
    onAvatarClick,
    onAvatarChange,
    onSubmit,
    onFirstNameChange,
    onLastNameChange,
    onEmailChange,
    onConfirmEmailChange,
    onPhoneChange,
    onCurrentPasswordChange,
    onNewPasswordChange,
    onConfirmPasswordChange,
    onOpenNewAddress,
    onOpenEditAddress,
    onCloseAddressEditor,
    onAddressFieldChange,
    onSaveAddress,
    onDeleteAddress,
    onOpenDeleteConfirm,
    onCloseDeleteConfirm,
    onConfirmDeleteAccount,
  } = useProfileEditState();

  return (
    <div className="bg-page min-h-screen">
      <ProfileHeader
        displayAvatarUrl={displayAvatarUrl}
        fullName={fullName}
        initials={initials}
        profileMeta={profileMeta}
        reviewsState={reviewsState}
        stats={stats}
        avatarInputRef={avatarInputRef}
        onAvatarChange={onAvatarChange}
        onAvatarClick={onAvatarClick}
      />

      <main className="mx-auto max-w-196 px-6 py-10 lg:px-10">
        <form
          className="space-y-7"
          onSubmit={onSubmit}
        >
          <PersonalInfoSection
            firstName={profileState.firstName}
            lastName={profileState.lastName}
            email={profileState.email}
            confirmEmail={profileState.confirmEmail}
            phone={profileState.phone}
            onFirstNameChange={onFirstNameChange}
            onLastNameChange={onLastNameChange}
            onEmailChange={onEmailChange}
            onConfirmEmailChange={onConfirmEmailChange}
            onPhoneChange={onPhoneChange}
          />

          <hr className="divider-subtle" />

          <AddressesSection
            state={addressState}
            onOpenNew={onOpenNewAddress}
            onOpenEdit={onOpenEditAddress}
            onCloseEditor={onCloseAddressEditor}
            onFieldChange={onAddressFieldChange}
            onSave={onSaveAddress}
            onDelete={(addressId) => void onDeleteAddress(addressId)}
          />

          <hr className="divider-subtle" />

          <PasswordSection
            currentPassword={profileState.currentPassword}
            newPassword={profileState.newPassword}
            confirmPassword={profileState.confirmPassword}
            onCurrentPasswordChange={onCurrentPasswordChange}
            onNewPasswordChange={onNewPasswordChange}
            onConfirmPasswordChange={onConfirmPasswordChange}
          />

          <hr className="divider-subtle" />

          <DangerZoneSection onDeleteClick={onOpenDeleteConfirm} />

          <SaveActions
            saveError={profileState.saveError}
            saveMessage={profileState.saveMessage}
            saving={saving}
          />
        </form>
      </main>

      {showDeleteConfirm && (
        <DeleteConfirmModal
          deletingAccount={deletingAccount}
          onClose={onCloseDeleteConfirm}
          onConfirm={() => void onConfirmDeleteAccount()}
        />
      )}
    </div>
  );
}

export { ProfileEdit };
