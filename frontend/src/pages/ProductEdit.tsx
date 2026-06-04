import { useEffect, useReducer, useState } from "react";
import { ArrowRight, Eye, Pause, Trash2, X } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { BasicInfoSection } from "@/components/product/BasicInfoSection";
import { ConditionsSection } from "@/components/product/ConditionsSection";
import { LocationSection } from "@/components/product/LocationSection";
import { PhotosSection } from "@/components/product/PhotosSection";
import { PreviewPanel } from "@/components/product/PreviewPanel";
import { PriceSection } from "@/components/product/PriceSection";
import { createAddress, fetchAddresses, isNewPhoto, uploadItemImages } from "@/components/product/productApi";
import { useAuth } from "@/hooks/useAuth";
import type { AddressResponse, CreateAddressRequest } from "@/types/address";
import type { ApiResponse } from "@/types/common";
import type {
  ExistingProductPhoto,
  ItemImageResponse,
  ItemResponse,
  ProductFormData,
  ProductPhoto,
  UpdateItemRequest,
} from "@/types/item";

const EMPTY_FORM: ProductFormData = {
  title: "",
  category: "",
  subcategory: "",
  condition: "",
  description: "",
  photos: [],
  pricePerDay: "",
  pricePerWeek: "",
  deposit: "",
  minRentalPeriod: "1",
  maxRentalPeriod: "30",
  address: "",
  city: "",
  deliveryRadius: "5",
  availableNow: true,
  blockDates: false,
  usageRules: "",
};

type FormErrors = Partial<Record<keyof ProductFormData, string>>;
type SaveStep = "idle" | "saving" | "uploading" | "done";

interface ProductEditState {
  data: ProductFormData;
  item: ItemResponse | null;
  loading: boolean;
  loadError: string;
  errors: FormErrors;
  saveStep: SaveStep;
  saveError: string;
  saveMessage: string;
}

type ProductEditAction =
  | { type: "load-start" }
  | { type: "load-success"; item: ItemResponse; images: ItemImageResponse[] }
  | { type: "load-error"; message: string }
  | { type: "set-item"; item: ItemResponse }
  | { type: "update-field"; field: keyof ProductFormData; value: string | boolean }
  | { type: "add-photos"; files: File[] }
  | { type: "remove-photo"; index: number }
  | { type: "set-errors"; errors: FormErrors }
  | { type: "clear-error"; field: keyof ProductFormData }
  | { type: "set-save-step"; step: SaveStep }
  | { type: "set-save-error"; message: string }
  | { type: "set-save-message"; message: string };

const INITIAL_STATE: ProductEditState = {
  data: EMPTY_FORM,
  item: null,
  loading: true,
  loadError: "",
  errors: {},
  saveStep: "idle",
  saveError: "",
  saveMessage: "",
};

const SAVE_STEP_LABELS: Record<SaveStep, string> = {
  idle: "Guardar cambios",
  saving: "Guardando…",
  uploading: "Subiendo fotos…",
  done: "Cambios guardados",
};

function isExistingPhoto(photo: ProductPhoto): photo is ExistingProductPhoto {
  return !(photo instanceof File);
}

function productEditReducer(state: ProductEditState, action: ProductEditAction): ProductEditState {
  switch (action.type) {
    case "load-start":
      return { ...state, loading: true, loadError: "" };
    case "load-success":
      return {
        ...state,
        item: action.item,
        data: itemToFormData(action.item, action.images),
        loading: false,
        loadError: "",
      };
    case "load-error":
      return { ...state, loading: false, loadError: action.message };
    case "set-item":
      return {
        ...state,
        item: action.item,
        data: { ...state.data, availableNow: action.item.item_status === "available" && action.item.is_available },
      };
    case "update-field":
      return {
        ...state,
        data: { ...state.data, [action.field]: action.value },
        errors: { ...state.errors, [action.field]: undefined },
        saveError: "",
        saveMessage: "",
      };
    case "add-photos":
      return {
        ...state,
        data: { ...state.data, photos: [...state.data.photos, ...action.files] },
        errors: { ...state.errors, photos: undefined },
        saveError: "",
        saveMessage: "",
      };
    case "remove-photo":
      return {
        ...state,
        data: { ...state.data, photos: state.data.photos.filter((_, index) => index !== action.index) },
        saveError: "",
        saveMessage: "",
      };
    case "set-errors":
      return { ...state, errors: action.errors };
    case "clear-error":
      return { ...state, errors: { ...state.errors, [action.field]: undefined } };
    case "set-save-step":
      return { ...state, saveStep: action.step };
    case "set-save-error":
      return { ...state, saveError: action.message, saveMessage: "" };
    case "set-save-message":
      return { ...state, saveError: "", saveMessage: action.message };
    default:
      return state;
  }
}

function itemToFormData(item: ItemResponse, images: ItemImageResponse[]): ProductFormData {
  return {
    ...EMPTY_FORM,
    title: item.title,
    category: item.category,
    condition: item.condition,
    description: item.description ?? "",
    photos: images
      .slice()
      .sort((a, b) => a.display_order - b.display_order)
      .map((image) => ({
        image_id: image.image_id,
        image_url: image.image_url,
        display_order: image.display_order,
      })),
    pricePerDay: String(item.price_per_day),
    pricePerWeek: "",
    deposit: item.deposit === undefined ? "" : String(item.deposit),
    minRentalPeriod: String(item.min_days || 1),
    maxRentalPeriod: item.max_days ? String(item.max_days) : "0",
    address: item.address_id,
    city: item.city,
    availableNow: item.is_available,
    usageRules: item.usage_rules ?? "",
  };
}

function validateForm(data: ProductFormData): FormErrors {
  const errors: FormErrors = {};

  if (!data.title.trim()) errors.title = "El titulo es obligatorio";
  if (!data.category) errors.category = "Selecciona una categoria";
  if (!data.condition) errors.condition = "Selecciona el estado de conservación";
  if (!data.description.trim()) errors.description = "La descripción es obligatoria";
  if (!data.pricePerDay || Number.parseFloat(data.pricePerDay) <= 0) {
    errors.pricePerDay = "El precio por dia debe ser mayor que 0";
  }

  const minRentalPeriod = Number.parseInt(data.minRentalPeriod, 10);
  const maxRentalPeriod = Number.parseInt(data.maxRentalPeriod, 10);
  if (data.maxRentalPeriod !== "0" && minRentalPeriod > maxRentalPeriod) {
    errors.minRentalPeriod = "El periodo mínimo no puede superar el máximo";
    errors.maxRentalPeriod = "El periodo máximo debe ser igual o mayor que el mínimo";
  }

  if (!data.address) errors.address = "Selecciona una dirección de recogida";
  if (data.photos.length === 0) errors.photos = "Añade al menos una foto del producto";

  return errors;
}

function formDataToPayload(data: ProductFormData): UpdateItemRequest {
  const maxDays = data.maxRentalPeriod === "0" ? undefined : Number.parseInt(data.maxRentalPeriod, 10);
  const deposit = data.deposit ? Number.parseFloat(data.deposit) : undefined;

  return {
    address_id: data.address,
    category: data.category,
    condition: data.condition,
    title: data.title.trim(),
    description: data.description.trim() || undefined,
    usage_rules: data.usageRules.trim() || undefined,
    price_per_day: Number.parseFloat(data.pricePerDay),
    deposit,
    min_days: Number.parseInt(data.minRentalPeriod, 10),
    max_days: maxDays,
    is_available: data.availableNow,
    item_status: data.availableNow ? "available" : "withdrawn",
  };
}

function formatRelativeDate(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const days = Math.max(0, Math.round((Date.now() - date.getTime()) / 86400000));
  if (days === 0) return "hoy";
  if (days === 1) return "hace 1 dia";
  return `hace ${days} días`;
}

async function fetchItem(itemId: string): Promise<ItemResponse> {
  const res = await fetch(`/api/items/${itemId}`, { credentials: "include" });
  const json = (await res.json()) as ApiResponse<ItemResponse>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message ?? json.error ?? "Error al cargar el anuncio");
  }
  return json.data;
}

async function fetchImages(itemId: string): Promise<ItemImageResponse[]> {
  const res = await fetch(`/api/items/${itemId}/images`, { credentials: "include" });
  const json = (await res.json()) as ApiResponse<ItemImageResponse[]>;
  return json.data ?? [];
}

async function updateItem(itemId: string, payload: UpdateItemRequest): Promise<ItemResponse> {
  const res = await fetch(`/api/items/${itemId}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = (await res.json()) as ApiResponse<ItemResponse>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message ?? json.error ?? "Error al guardar el anuncio");
  }
  return json.data;
}

async function deleteItem(itemId: string): Promise<void> {
  const res = await fetch(`/api/items/${itemId}`, {
    method: "DELETE",
    credentials: "include",
  });
  const json = (await res.json()) as ApiResponse<{ message: string }>;
  if (!res.ok || !json.success) {
    throw new Error(json.message ?? json.error ?? "Error al eliminar el anuncio");
  }
}

async function deleteItemImage(itemId: string, imageId: string): Promise<void> {
  const res = await fetch(`/api/items/${itemId}/images/${imageId}`, {
    method: "DELETE",
    credentials: "include",
  });
  const json = (await res.json()) as ApiResponse<{ message: string }>;
  if (!res.ok || !json.success) {
    throw new Error(json.message ?? json.error ?? "Error al eliminar la imagen");
  }
}

interface DeleteProductConfirmModalProps {
  deleting: boolean;
  productTitle: string;
  onClose: () => void;
  onConfirm: () => void;
}

function DeleteProductConfirmModal({ deleting, productTitle, onClose, onConfirm }: DeleteProductConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="border-border-main w-full max-w-md rounded-xl border bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="heading-panel--sm">Eliminar anuncio</h2>
            <p className="text-subtle mt-2 text-[13px]">
              Se eliminara "{productTitle}" de forma permanente. Esta accion no se puede deshacer.
            </p>
          </div>
          <button
            type="button"
            className="text-subtle hover:text-ink p-0"
            aria-label="Cerrar confirmacion"
            onClick={onClose}
            disabled={deleting}
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="btn-secondary btn--sm"
            onClick={onClose}
            disabled={deleting}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn-danger-outline btn--sm"
            onClick={onConfirm}
            disabled={deleting}
          >
            <Trash2 size={14} />
            {deleting ? "Eliminando…" : "Confirmar eliminación"}
          </button>
        </div>
      </div>
    </div>
  );
}

function useProductEditController() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [state, dispatch] = useReducer(productEditReducer, INITIAL_STATE);
  const [addresses, setAddresses] = useState<AddressResponse[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isSaving = state.saveStep === "saving" || state.saveStep === "uploading";
  const isOwner = Boolean(state.item && user?.customer_id === state.item.owner_id);
  const isPublished = state.item?.item_status === "available" && state.item.is_available;
  const lastEditedLabel = formatRelativeDate(state.item?.published_at);

  useEffect(() => {
    if (!id) {
      dispatch({ type: "load-error", message: "No se encontró el identificador del anuncio" });
      return;
    }

    dispatch({ type: "load-start" });
    void Promise.all([fetchItem(id), fetchImages(id), fetchAddresses()])
      .then(([item, images, loadedAddresses]) => {
        dispatch({ type: "load-success", item, images });
        setAddresses(loadedAddresses);
      })
      .catch((err: unknown) => {
        dispatch({
          type: "load-error",
          message: err instanceof Error ? err.message : "Error al cargar el anuncio",
        });
      });
  }, [id]);

  const updateFormField = (field: keyof ProductFormData, value: string | boolean) => {
    dispatch({ type: "update-field", field, value });

    if (field === "address" && typeof value === "string") {
      const selectedAddress = addresses.find((address) => address.address_id === value);
      if (selectedAddress) {
        dispatch({ type: "update-field", field: "city", value: selectedAddress.city });
      }
    }
  };

  const addPhotosToForm = (files: File[]) => {
    dispatch({ type: "add-photos", files });
    if (state.errors.photos) dispatch({ type: "clear-error", field: "photos" });
  };

  const removePhotoFromForm = (index: number) => {
    if (!id) return;
    if (state.data.photos.length <= 1) {
      dispatch({
        type: "set-save-error",
        message: "El anuncio debe tener al menos una foto.",
      });
      return;
    }

    const photo = state.data.photos[index];
    if (photo && isExistingPhoto(photo)) {
      void deleteItemImage(id, photo.image_id)
        .then(() => {
          dispatch({ type: "remove-photo", index });
        })
        .catch((err: unknown) => {
          dispatch({
            type: "set-save-error",
            message: err instanceof Error ? err.message : "Error al eliminar la imagen",
          });
        });
      return;
    }

    dispatch({ type: "remove-photo", index });
  };

  const handleAddressCreated = async (req: CreateAddressRequest): Promise<void> => {
    const newAddress = await createAddress(req);
    setAddresses((prev) => [...prev, newAddress]);
    updateFormField("address", newAddress.address_id);
  };

  const handleSubmit = () => {
    if (!id) return;

    const newErrors = validateForm(state.data);
    if (Object.keys(newErrors).length > 0) {
      dispatch({ type: "set-errors", errors: newErrors });
      const firstKey = Object.keys(newErrors)[0] ?? "";
      document.getElementById(firstKey)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const run = async () => {
      try {
        dispatch({ type: "set-save-step", step: "saving" });
        const updatedItem = await updateItem(id, formDataToPayload(state.data));

        const newPhotos = state.data.photos.filter(isNewPhoto);
        if (newPhotos.length > 0) {
          dispatch({ type: "set-save-step", step: "uploading" });
          await uploadItemImages(id, newPhotos);
        }

        const images = await fetchImages(id);
        dispatch({ type: "load-success", item: updatedItem, images });
        dispatch({ type: "set-save-step", step: "done" });
        dispatch({ type: "set-save-message", message: "Cambios guardados correctamente." });
      } catch (err: unknown) {
        dispatch({ type: "set-save-step", step: "idle" });
        dispatch({
          type: "set-save-error",
          message: err instanceof Error ? err.message : "Error al guardar el anuncio",
        });
      }
    };

    void run();
  };

  const handleToggleListingStatus = () => {
    if (!id || !state.item) return;

    const nextAvailable = !isPublished;
    const nextData = { ...state.data, availableNow: nextAvailable };

    const run = async () => {
      try {
        dispatch({ type: "set-save-step", step: "saving" });
        const updatedItem = await updateItem(id, formDataToPayload(nextData));
        dispatch({ type: "set-item", item: updatedItem });
        dispatch({
          type: "set-save-message",
          message: nextAvailable ? "Anuncio publicado correctamente." : "Anuncio pausado correctamente.",
        });
      } catch (err: unknown) {
        dispatch({
          type: "set-save-error",
          message: err instanceof Error ? err.message : "Error al cambiar el estado del anuncio",
        });
      } finally {
        dispatch({ type: "set-save-step", step: "idle" });
      }
    };

    void run();
  };

  const handleDeleteProduct = () => {
    if (!id) return;

    const run = async () => {
      try {
        dispatch({ type: "set-save-step", step: "saving" });
        await deleteItem(id);
        setShowDeleteConfirm(false);
        void navigate("/profile");
      } catch (err: unknown) {
        dispatch({ type: "set-save-step", step: "idle" });
        dispatch({
          type: "set-save-error",
          message: err instanceof Error ? err.message : "Error al eliminar el anuncio",
        });
      }
    };

    void run();
  };

  return {
    state,
    addresses,
    showDeleteConfirm,
    isSaving,
    isOwner,
    isPublished,
    lastEditedLabel,
    navigate,
    updateFormField,
    addPhotosToForm,
    removePhotoFromForm,
    handleAddressCreated,
    handleSubmit,
    handleToggleListingStatus,
    handleDeleteProduct,
    openDeleteConfirm: () => setShowDeleteConfirm(true),
    closeDeleteConfirm: () => setShowDeleteConfirm(false),
  };
}

interface ProductEditLoadingProps {
  text: string;
}

function ProductEditLoading({ text }: ProductEditLoadingProps) {
  return (
    <div className="bg-surface min-h-screen py-8">
      <div className="px-layout-margin mx-auto max-w-[1280px]">
        <div className="border-border-main rounded-xl border bg-white p-6">{text}</div>
      </div>
    </div>
  );
}

interface ProductEditMessageProps {
  title: string;
  message: string;
  actionLabel: string;
  onAction: () => void;
}

function ProductEditMessage({ title, message, actionLabel, onAction }: ProductEditMessageProps) {
  return (
    <div className="bg-surface min-h-screen py-8">
      <div className="px-layout-margin mx-auto flex max-w-[1280px] flex-col items-center gap-4 py-20 text-center">
        <h1 className="heading-panel">{title}</h1>
        <p className="text-subtle">{message}</p>
        <button
          type="button"
          className="btn-secondary btn--md"
          onClick={onAction}
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
}

interface ProductEditHeaderProps {
  item: ItemResponse;
  isPublished: boolean;
  isSaving: boolean;
  lastEditedLabel: string;
  onToggleStatus: () => void;
  onView: () => void;
  onDelete: () => void;
}

function ProductEditHeader({
  item,
  isPublished,
  isSaving,
  lastEditedLabel,
  onToggleStatus,
  onView,
  onDelete,
}: ProductEditHeaderProps) {
  return (
    <header className="border-border-main mb-8 rounded-xl border bg-white p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <span className="product-status-badge">{isPublished ? "Publicado" : "Pausado"}</span>
          {lastEditedLabel && <p className="field-hint">Ultima edicion: {lastEditedLabel}</p>}
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="btn-secondary btn--sm"
            onClick={onToggleStatus}
            disabled={isSaving}
          >
            <Pause size={14} />
            {isPublished ? "Pausar anuncio" : "Activar anuncio"}
          </button>
          <button
            type="button"
            className="btn-secondary btn--sm"
            onClick={onView}
          >
            <Eye size={14} />
            Ver anuncio
            <ArrowRight size={14} />
          </button>
          <button
            type="button"
            className="btn-danger-outline btn--sm"
            onClick={onDelete}
            disabled={isSaving}
          >
            <Trash2 size={14} />
            Eliminar
          </button>
        </div>
      </div>
      <span className="sr-only">{item.title}</span>
    </header>
  );
}

interface ProductEditFormProps {
  state: ProductEditState;
  addresses: AddressResponse[];
  isSaving: boolean;
  onFieldChange: (field: keyof ProductFormData, value: string | boolean) => void;
  onAddPhotos: (files: File[]) => void;
  onRemovePhoto: (index: number) => void;
  onAddressCreated: (req: CreateAddressRequest) => Promise<void>;
  onUsageRulesChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}

function ProductEditForm({
  state,
  addresses,
  isSaving,
  onFieldChange,
  onAddPhotos,
  onRemovePhoto,
  onAddressCreated,
  onUsageRulesChange,
  onCancel,
  onSubmit,
}: ProductEditFormProps) {
  return (
    <div className="grid grid-cols-[1fr_360px] items-start gap-8 xl:grid-cols-[1fr_380px]">
      <div className="flex flex-col gap-6">
        <BasicInfoSection
          data={state.data}
          errors={state.errors}
          onChange={onFieldChange}
        />

        <PhotosSection
          photos={state.data.photos}
          error={state.errors.photos}
          onAddPhotos={onAddPhotos}
          onRemovePhoto={onRemovePhoto}
        />

        <PriceSection
          data={state.data}
          errors={state.errors}
          onChange={onFieldChange}
        />

        <LocationSection
          data={state.data}
          errors={state.errors}
          addresses={addresses}
          onChange={onFieldChange}
          onAddressCreated={onAddressCreated}
        />

        <ConditionsSection
          value={state.data.usageRules}
          onChange={onUsageRulesChange}
        />

        {state.saveError && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600"
          >
            {state.saveError}
          </div>
        )}
        {state.saveMessage && (
          <output className="border-primary-border bg-primary-light text-primary rounded-lg border p-4 text-sm">
            {state.saveMessage}
          </output>
        )}

        <ProductEditSaveActions
          isSaving={isSaving}
          saveStep={state.saveStep}
          onCancel={onCancel}
          onSubmit={onSubmit}
        />
      </div>

      <PreviewPanel formData={state.data} />
    </div>
  );
}

interface ProductEditSaveActionsProps {
  isSaving: boolean;
  saveStep: SaveStep;
  onCancel: () => void;
  onSubmit: () => void;
}

function ProductEditSaveActions({ isSaving, saveStep, onCancel, onSubmit }: ProductEditSaveActionsProps) {
  return (
    <div className="border-border-main flex flex-col-reverse gap-4 border-t pt-6 pb-10 sm:flex-row">
      <button
        type="button"
        className="btn-secondary btn--lg sm:w-52"
        onClick={onCancel}
        disabled={isSaving}
      >
        Cancelar cambios
      </button>
      <button
        type="button"
        className="btn-primary btn--lg flex-1"
        onClick={onSubmit}
        disabled={isSaving}
      >
        {isSaving ? (
          <span className="flex items-center justify-center gap-2">
            <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            {SAVE_STEP_LABELS[saveStep]}
          </span>
        ) : (
          SAVE_STEP_LABELS[saveStep]
        )}
      </button>
    </div>
  );
}

/**
 * Form page for editing an existing listing.
 * @returns The product edit page.
 */
function ProductEdit() {
  const controller = useProductEditController();
  const { state, navigate } = controller;

  if (state.loading) {
    return <ProductEditLoading text="Cargando anuncio…" />;
  }

  if (state.loadError || !state.item) {
    return (
      <ProductEditMessage
        title="No se pudo cargar el anuncio"
        message={state.loadError || "Este anuncio no existe o no esta disponible."}
        actionLabel="Volver a mi perfil"
        onAction={() => void navigate("/profile")}
      />
    );
  }

  const item = state.item;

  if (!controller.isOwner) {
    return (
      <ProductEditMessage
        title="No puedes editar este anuncio"
        message="Solo el propietario puede modificar la publicacion."
        actionLabel="Ver anuncio"
        onAction={() => void navigate(`/product/${item.item_id}`)}
      />
    );
  }

  return (
    <div className="bg-surface min-h-screen py-8">
      <div className="px-layout-margin mx-auto max-w-[1280px]">
        <ProductEditHeader
          item={item}
          isPublished={controller.isPublished}
          isSaving={controller.isSaving}
          lastEditedLabel={controller.lastEditedLabel}
          onToggleStatus={controller.handleToggleListingStatus}
          onView={() => void navigate(`/product/${item.item_id}`)}
          onDelete={controller.openDeleteConfirm}
        />

        <ProductEditForm
          state={state}
          addresses={controller.addresses}
          isSaving={controller.isSaving}
          onFieldChange={controller.updateFormField}
          onAddPhotos={controller.addPhotosToForm}
          onRemovePhoto={controller.removePhotoFromForm}
          onAddressCreated={controller.handleAddressCreated}
          onUsageRulesChange={(value) => controller.updateFormField("usageRules", value)}
          onCancel={() => void navigate("/profile")}
          onSubmit={controller.handleSubmit}
        />
      </div>

      {controller.showDeleteConfirm && (
        <DeleteProductConfirmModal
          deleting={controller.isSaving}
          productTitle={item.title}
          onClose={controller.closeDeleteConfirm}
          onConfirm={controller.handleDeleteProduct}
        />
      )}
    </div>
  );
}

export { ProductEdit };
