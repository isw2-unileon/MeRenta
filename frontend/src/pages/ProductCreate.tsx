import { useEffect, useState } from "react";
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
  const [formData, setFormData] = useState<ProductFormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitStep, setSubmitStep] = useState<SubmitStep>("idle");
  const [submitError, setSubmitError] = useState("");
  const [addresses, setAddresses] = useState<AddressResponse[]>([]);

  const isSubmitting = submitStep !== "idle" && submitStep !== "done";

  // Load the user's saved addresses once on mount.
  useEffect(() => {
    void fetchAddresses().then(setAddresses);
  }, []);

  const handleChange = (field: keyof ProductFormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleAddPhotos = (files: File[]) => {
    setFormData((prev) => ({ ...prev, photos: [...prev.photos, ...files] }));
    if (errors.photos) {
      setErrors((prev) => ({ ...prev, photos: undefined }));
    }
  };

  const handleRemovePhoto = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index),
    }));
  };

  /**
   * Creates a new address, refreshes the list, and pre-selects the new entry.
   */
  const handleAddressCreated = async (req: CreateAddressRequest): Promise<void> => {
    const newAddr = await createAddress(req);
    setAddresses((prev) => [...prev, newAddr]);
    handleChange("address", newAddr.address_id);
  };

  /**
   * Validates and runs the two-step submit flow:
   *   1. POST /api/items             → create the listing
   *   2. POST /api/items/:id/images  → upload photos (backend stores them in Supabase)
   *
   * When `asDraft` is true only the item record is created (no image upload).
   */
  const handleSubmit = (asDraft = false) => {
    const newErrors = validateForm(formData);
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      const firstKey = Object.keys(newErrors)[0] ?? "";
      document.getElementById(firstKey)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setSubmitError("");

    const run = async () => {
      try {
        setSubmitStep("creating");

        const item = await createItem({
          address_id: formData.address,
          category: formData.category,
          title: formData.title.trim(),
          description: formData.description.trim() || undefined,
          price_per_day: parseFloat(formData.pricePerDay),
          deposit: formData.deposit ? parseFloat(formData.deposit) : undefined,
        });

        if (!asDraft && formData.photos.length > 0) {
          setSubmitStep("uploading");
          await uploadItemImages(item.item_id, formData.photos);
        }

        setSubmitStep("done");
        await navigate(`/product/${item.item_id}`);
      } catch (err) {
        setSubmitStep("idle");
        setSubmitError(err instanceof Error ? err.message : "Error al publicar el anuncio. Inténtalo de nuevo.");
      }
    };

    void run();
  };

  return (
    <div className="min-h-screen bg-surface py-8">
      <div className="mx-auto max-w-[1280px] px-layout-margin">
        <header className="mb-8">
          <h2 className="heading-panel">Publicar nuevo anuncio</h2>
          <p className="field-hint mt-1">Completa el formulario para publicar tu producto en MeRenta.</p>
        </header>

        <div className="grid grid-cols-[1fr_360px] items-start gap-8 xl:grid-cols-[1fr_380px]">
          {/* ── Left: form ─────────────────────────────────────────────── */}
          <div className="flex flex-col gap-6">
            <BasicInfoSection data={formData} errors={errors} onChange={handleChange} />

            <PhotosSection
              photos={formData.photos}
              error={errors.photos}
              onAddPhotos={handleAddPhotos}
              onRemovePhoto={handleRemovePhoto}
            />

            <PriceSection data={formData} errors={errors} onChange={handleChange} />

            <LocationSection
              data={formData}
              errors={errors}
              addresses={addresses}
              onChange={handleChange}
              onAddressCreated={handleAddressCreated}
            />

            <ConditionsSection
              value={formData.usageRules}
              onChange={(v) => handleChange("usageRules", v)}
            />

            {submitError && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600"
              >
                {submitError}
              </div>
            )}

            <div className="flex items-center justify-between border-t border-border-main pt-6 pb-10">
              <button
                type="button"
                className="btn-secondary btn--lg"
                onClick={() => handleSubmit(true)}
                disabled={isSubmitting}
              >
                Guardar borrador
              </button>

              <button
                type="button"
                className="btn-primary btn--lg min-w-[200px]"
                onClick={() => handleSubmit(false)}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    {STEP_LABELS[submitStep]}
                  </span>
                ) : (
                  "Continuar — Fotos →"
                )}
              </button>
            </div>
          </div>

          {/* ── Right: live preview ────────────────────────────────────── */}
          <PreviewPanel formData={formData} />
        </div>
      </div>
    </div>
  );
}

export { ProductCreate };
