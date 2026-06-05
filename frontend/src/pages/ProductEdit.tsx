import { useEffect, useReducer, useState } from "react";
import { ArrowRight, Eye, Pause, Trash2, X } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { BasicInfoSection } from "@/components/product/BasicInfoSection";
import { ConditionsSection } from "@/components/product/ConditionsSection";
import { LocationSection } from "@/components/product/LocationSection";
import { PhotosSection } from "@/components/product/PhotosSection";
import { PreviewPanel } from "@/components/product/PreviewPanel";
import { PriceSection } from "@/components/product/PriceSection";
import {
  createAddress,
  fetchAddresses,
  isNewPhoto,
  reportFormErrors,
  uploadItemImages,
} from "@/components/product/productApi";
import { useAuth } from "@/hooks/useAuth";
import {
  INITIAL_STATE,
  SAVE_STEP_LABELS,
  formDataToPayload,
  formatRelativeDate,
  isExistingPhoto,
  productEditReducer,
  validateForm,
  type ProductEditState,
  type SaveStep,
} from "./ProductEdit.logic";
import type { AddressResponse, CreateAddressRequest } from "@/types/address";
import type { ApiResponse } from "@/types/common";
import type {
  ItemImageResponse,
  ItemResponse,
  ProductFormData,
  UpdateItemRequest,
} from "@/types/item";


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
    if (reportFormErrors(newErrors, () => dispatch({ type: "set-errors", errors: newErrors }))) {
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
