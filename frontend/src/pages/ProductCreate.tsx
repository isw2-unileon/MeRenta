import { useEffect, useReducer, useState } from "react";
import { useNavigate } from "react-router-dom";

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
import { INITIAL_STATE, STEP_LABELS, formReducer, validateForm } from "./ProductCreate.logic";
import type { ApiResponse } from "@/types/common";
import type { AddressResponse, CreateAddressRequest } from "@/types/address";
import type { CreateItemRequest, ItemResponse, ProductFormData } from "@/types/item";

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
 * Full-page form for publishing a new product listing.
 * Left column contains the multisection form; the right column shows a live preview.
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
    if (reportFormErrors(newErrors, () => dispatch({ type: "set-errors", errors: newErrors }))) {
      return;
    }

    dispatch({ type: "set-submit-error", message: "" });

    const run = async () => {
      try {
        dispatch({ type: "set-submit-step", step: "creating" });

        const item = await createItem({
          address_id: state.data.address,
          category: state.data.category,
          condition: state.data.condition,
          title: state.data.title.trim(),
          description: state.data.description.trim() || undefined,
          usage_rules: state.data.usageRules.trim() || undefined,
          price_per_day: parseFloat(state.data.pricePerDay),
          deposit: state.data.deposit ? parseFloat(state.data.deposit) : undefined,
          min_days: Number.parseInt(state.data.minRentalPeriod, 10),
          max_days: state.data.maxRentalPeriod === "0" ? undefined : Number.parseInt(state.data.maxRentalPeriod, 10),
        });

        const newPhotos = state.data.photos.filter(isNewPhoto);
        if (!asDraft && newPhotos.length > 0) {
          dispatch({ type: "set-submit-step", step: "uploading" });
          await uploadItemImages(item.item_id, newPhotos);
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
