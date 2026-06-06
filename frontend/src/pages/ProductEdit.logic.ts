// State model, reducer, validation and payload mapping for the product-edit
// page, kept UI-free for easy unit testing.
import type {
  ExistingProductPhoto,
  ItemImageResponse,
  ItemResponse,
  ProductFormData,
  ProductPhoto,
  UpdateItemRequest,
} from "@/types/item";

/** Default values for a blank edit form (before the item loads). */
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

/** User-facing button labels for each save step. */
const SAVE_STEP_LABELS: Record<SaveStep, string> = {
  idle: "Guardar cambios",
  saving: "Guardando",
  uploading: "Subiendo fotos",
  done: "Cambios guardados",
};

/** True when a photo is an already-stored image (not a newly selected File). */
function isExistingPhoto(photo: ProductPhoto): photo is ExistingProductPhoto {
  return !(photo instanceof File);
}

/** Reduces edit-form actions (load, field edits, photos, save) into the next state. */
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

/** Maps a loaded item and its images into editable form state. */
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

/** Validates the edit form, returning a map of field errors (empty when valid). */
function validateForm(data: ProductFormData): FormErrors {
  const errors: FormErrors = {};

  if (!data.title.trim()) errors.title = "El titulo es obligatorio";
  if (!data.category) errors.category = "Selecciona una categoría";
  if (!data.condition) errors.condition = "Selecciona el estado de conservación";
  if (!data.description.trim()) errors.description = "La descripción es obligatoria";
  if (!data.pricePerDay || Number.parseFloat(data.pricePerDay) <= 0) {
    errors.pricePerDay = "El precio por día debe ser mayor que 0";
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

/** Maps the edit form state into the PATCH /api/items/:id request payload. */
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

/** Formats a date as a Spanish relative label (e.g. "hoy", "hace 3 días"). */
function formatRelativeDate(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const days = Math.max(0, Math.round((Date.now() - date.getTime()) / 86400000));
  if (days === 0) return "hoy";
  if (days === 1) return "hace 1 dia";
  return `hace ${days} días`;
}

export {
  EMPTY_FORM,
  INITIAL_STATE,
  SAVE_STEP_LABELS,
  isExistingPhoto,
  productEditReducer,
  itemToFormData,
  validateForm,
  formDataToPayload,
  formatRelativeDate,
};
export type { FormErrors, ProductEditAction, ProductEditState, SaveStep };
