import { useEffect, useReducer, useState } from "react";
import { useNavigate } from "react-router-dom";

import { BasicInfoSection } from "@/components/product/BasicInfoSection";
import { ConditionsSection } from "@/components/product/ConditionsSection";
import { LocationSection } from "@/components/product/LocationSection";
import { PhotosSection } from "@/components/product/PhotosSection";
import { PreviewPanel } from "@/components/product/PreviewPanel";
import { PriceSection } from "@/components/product/PriceSection";
import type { ApiResponse } from "@/types/common";
import type { AddressResponse, CreateAddressRequest } from "@/types/address";
import type { CreateItemRequest, ItemImageResponse, ItemResponse, ProductFormData } from "@/types/item";

const INITIAL_FORM: ProductFormData = {
  title: "",
  category: "",
  subcategory: "",
  condition: "",
  description: "",
  photos: [],
  pricePerDay: "",
  pricePerWeek: "",
  deposit: "50",
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

/** Submission progress shown to the user during the async flow. */
type SubmitStep = "idle" | "creating" | "uploading" | "done";

const STEP_LABELS: Record<SubmitStep, string> = {
  idle: "",
  creating: "Creando anuncio...",
  uploading: "Subiendo fotos...",
  done: "¡Publicado!",
};

interface FormState {
  data: ProductFormData;
  errors: FormErrors;
  submitStep: SubmitStep;
  submitError: string;
}

type FormAction =
  | { type: "update-field"; field: keyof ProductFormData; value: string | boolean }
  | { type: "set-errors"; errors: FormErrors }
  | { type: "clear-error"; field: keyof ProductFormData }
  | { type: "add-photos"; files: File[] }
  | { type: "remove-photo"; index: number }
  | { type: "set-submit-step"; step: SubmitStep }
  | { type: "set-submit-error"; message: string };

const INITIAL_STATE: FormState = {
  data: INITIAL_FORM,
  errors: {},
  submitStep: "idle",
  submitError: "",
};

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "update-field": {
      const nextErrors = state.errors[action.field] ? { ...state.errors, [action.field]: undefined } : state.errors;
      return {
        ...state,
        data: { ...state.data, [action.field]: action.value },
        errors: nextErrors,
      };
    }
    case "set-errors":
      return { ...state, errors: action.errors };
    case "clear-error":
      return { ...state, errors: { ...state.errors, [action.field]: undefined } };
    case "add-photos":
      return { ...state, data: { ...state.data, photos: [...state.data.photos, ...action.files] } };
    case "remove-photo":
      return {
        ...state,
        data: { ...state.data, photos: state.data.photos.filter((_, i) => i !== action.index) },
      };
    case "set-submit-step":
      return { ...state, submitStep: action.step };
    case "set-submit-error":
      return { ...state, submitError: action.message };
    default:
      return state;
  }
}

/**
 * Validates the form and returns a map of field-level errors.
 */
function validateForm(data: ProductFormData): FormErrors {
  const errors: FormErrors = {};

  if (!data.title.trim()) {
    errors.title = "El título es obligatorio";
  } else if (data.title.length > 80) {
    errors.title = "El título no puede superar 80 caracteres";
  }

  if (!data.category) {
    errors.category = "Selecciona una categoría";
  }

  if (!data.condition) {
    errors.condition = "Selecciona el estado de conservación";
  }

  if (!data.description.trim()) {
    errors.description = "La descripción es obligatoria";
  } else if (data.description.trim().length < 100) {
    errors.description = "La descripción debe tener al menos 100 caracteres";
  }

  if (!data.pricePerDay || parseFloat(data.pricePerDay) <= 0) {
    errors.pricePerDay = "El precio por día debe ser mayor que 0";
  }

  const minRentalPeriod = Number.parseInt(data.minRentalPeriod, 10);
  const maxRentalPeriod = Number.parseInt(data.maxRentalPeriod, 10);
  if (data.maxRentalPeriod !== "0" && minRentalPeriod > maxRentalPeriod) {
    errors.minRentalPeriod = "El período mínimo no puede superar el máximo";
    errors.maxRentalPeriod = "El período máximo debe ser igual o mayor que el mínimo";
  }

  if (!data.address) {
    errors.address = "Selecciona una dirección de recogida";
  }

  if (data.photos.length === 0) {
    errors.photos = "Añade al menos una foto del producto";
  }

  return errors;
}

/** Calls POST /api/items to create a new listing. */
async function createItem(payload: CreateItemRequest): Promise<ItemResponse> {
  const res = await fetch("/api/items", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const json = (await res.json()) as ApiResponse<ItemResponse>;

  if (!res.ok || !json.success) {
    throw new Error(json.message ?? json.error ?? "Error al crear el anuncio");
  }

  if (!json.data) throw new Error("Respuesta inesperada del servidor");

  return json.data;
}

/**
 * Calls POST /api/items/:id/images with the photo files.
 * The backend handles uploading to Supabase Storage and signing URLs.
 */
async function uploadItemImages(itemId: string, photos: File[]): Promise<void> {
  const form = new FormData();
  for (const file of photos) {
    form.append("images", file);
  }

  const res = await fetch(`/api/items/${itemId}/images`, {
    method: "POST",
    credentials: "include",
    body: form,
  });

  const json = (await res.json()) as ApiResponse<ItemImageResponse[]>;

  if (!res.ok || !json.success) {
    throw new Error(json.message ?? json.error ?? "Error al subir las imágenes");
  }
}

/** Fetches the authenticated user's saved addresses. */
async function fetchAddresses(): Promise<AddressResponse[]> {
  const res = await fetch("/api/addresses", { credentials: "include" });
  const json = (await res.json()) as ApiResponse<AddressResponse[]>;
  return json.data ?? [];
}

/** Calls POST /api/addresses to create and return a new address. */
async function createAddress(req: CreateAddressRequest): Promise<AddressResponse> {
  const res = await fetch("/api/addresses", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });

  const json = (await res.json()) as ApiResponse<AddressResponse>;

  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message ?? json.error ?? "Error al guardar la dirección");
  }

  return json.data;
}

/**
 * Full-page form for publishing a new product listing.
 * Left column contains the multi-section form; the right column shows a live preview.
 */
function ProductCreate() {
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(formReducer, INITIAL_STATE);
  const [addresses, setAddresses] = useState<AddressResponse[]>([]);

  const isSubmitting = state.submitStep !== "idle" && state.submitStep !== "done";

  // Load the user's saved addresses once on mount.
  useEffect(() => {
    void fetchAddresses().then(setAddresses);
  }, []);

  const updateFormField = (field: keyof ProductFormData, value: string | boolean) => {
    dispatch({ type: "update-field", field, value });
  };

  const addPhotosToForm = (files: File[]) => {
    dispatch({ type: "add-photos", files });
    if (state.errors.photos) {
      dispatch({ type: "clear-error", field: "photos" });
    }
  };

  const removePhotoFromForm = (index: number) => {
    dispatch({ type: "remove-photo", index });
  };

  /**
   * Creates a new address, refreshes the list, and pre-selects the new entry.
   */
  const handleAddressCreated = async (req: CreateAddressRequest): Promise<void> => {
    const newAddr = await createAddress(req);
    setAddresses((prev) => [...prev, newAddr]);
    updateFormField("address", newAddr.address_id);
  };

  /**
   * Validates and runs the two-step submit flow:
   *   1. POST /api/items             → create the listing
   *   2. POST /api/items/:id/images  → upload photos (backend stores them in Supabase)
   *
   * When `asDraft` is true only the item record is created (no image upload).
   */
  const submitProduct = (asDraft = false) => {
    const newErrors = validateForm(state.data);
    if (Object.keys(newErrors).length > 0) {
      dispatch({ type: "set-errors", errors: newErrors });
      const firstKey = Object.keys(newErrors)[0] ?? "";
      document.getElementById(firstKey)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    dispatch({ type: "set-submit-error", message: "" });

    const run = async () => {
      try {
        dispatch({ type: "set-submit-step", step: "creating" });

        const item = await createItem({
          address_id: state.data.address,
          category: state.data.category,
          title: state.data.title.trim(),
          description: state.data.description.trim() || undefined,
          price_per_day: parseFloat(state.data.pricePerDay),
          deposit: state.data.deposit ? parseFloat(state.data.deposit) : undefined,
          min_days: Number.parseInt(state.data.minRentalPeriod, 10),
          max_days: state.data.maxRentalPeriod === "0" ? undefined : Number.parseInt(state.data.maxRentalPeriod, 10),
        });

        if (!asDraft && state.data.photos.length > 0) {
          dispatch({ type: "set-submit-step", step: "uploading" });
          await uploadItemImages(item.item_id, state.data.photos);
        }

        dispatch({ type: "set-submit-step", step: "done" });
        await navigate(`/product/${item.item_id}`);
      } catch (err) {
        dispatch({ type: "set-submit-step", step: "idle" });
        dispatch({
          type: "set-submit-error",
          message: err instanceof Error ? err.message : "Error al publicar el anuncio. Inténtalo de nuevo.",
        });
      }
    };

    void run();
  };

  return (
    <div className="bg-surface min-h-screen py-8">
      <div className="px-layout-margin mx-auto max-w-[1280px]">
        <header className="mb-8">
          <h2 className="heading-panel">Publicar nuevo anuncio</h2>
          <p className="field-hint mt-1">Completa el formulario para publicar tu producto en MeRenta.</p>
        </header>

        <div className="grid grid-cols-[1fr_360px] items-start gap-8 xl:grid-cols-[1fr_380px]">
          <div className="flex flex-col gap-6">
            <BasicInfoSection
              data={state.data}
              errors={state.errors}
              onChange={updateFormField}
            />

            <PhotosSection
              photos={state.data.photos}
              error={state.errors.photos}
              onAddPhotos={addPhotosToForm}
              onRemovePhoto={removePhotoFromForm}
            />

            <PriceSection
              data={state.data}
              errors={state.errors}
              onChange={updateFormField}
            />

            <LocationSection
              data={state.data}
              errors={state.errors}
              addresses={addresses}
              onChange={updateFormField}
              onAddressCreated={handleAddressCreated}
            />

            <ConditionsSection
              value={state.data.usageRules}
              onChange={(v) => updateFormField("usageRules", v)}
            />

            {state.submitError && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600"
              >
                {state.submitError}
              </div>
            )}

            <div className="border-border-main flex items-center justify-center border-t pt-6 pb-10">
              <button
                type="button"
                className="btn-primary btn--lg min-w-[200px]"
                onClick={() => submitProduct(false)}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    {STEP_LABELS[state.submitStep]}
                  </span>
                ) : (
                  "Crear producto"
                )}
              </button>
            </div>
          </div>

          <PreviewPanel formData={state.data} />
        </div>
      </div>
    </div>
  );
}

export { ProductCreate };
