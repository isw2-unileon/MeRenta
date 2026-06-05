import type { ProductFormData } from "@/types/item";

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
type SubmitStep = "idle" | "creating" | "uploading" | "done";

const STEP_LABELS: Record<SubmitStep, string> = {
  idle: "",
  creating: "Creando anuncio...",
  uploading: "Subiendo fotos...",
  done: "Â¡Publicado!",
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

function validateForm(data: ProductFormData): FormErrors {
  const errors: FormErrors = {};

  if (!data.title.trim()) {
    errors.title = "El tÃ­tulo es obligatorio";
  } else if (data.title.length > 80) {
    errors.title = "El tÃ­tulo no puede superar 80 caracteres";
  }

  if (!data.category) {
    errors.category = "Selecciona una categorÃ­a";
  }

  if (!data.condition) {
    errors.condition = "Selecciona el estado de conservaciÃ³n";
  }

  if (!data.description.trim()) {
    errors.description = "La descripciÃ³n es obligatoria";
  } else if (data.description.trim().length < 100) {
    errors.description = "La descripciÃ³n debe tener al menos 100 caracteres";
  }

  if (!data.pricePerDay || parseFloat(data.pricePerDay) <= 0) {
    errors.pricePerDay = "El precio por dÃ­a debe ser mayor que 0";
  }

  const minRentalPeriod = Number.parseInt(data.minRentalPeriod, 10);
  const maxRentalPeriod = Number.parseInt(data.maxRentalPeriod, 10);
  if (data.maxRentalPeriod !== "0" && minRentalPeriod > maxRentalPeriod) {
    errors.minRentalPeriod = "El perÃ­odo mÃ­nimo no puede superar el mÃ¡ximo";
    errors.maxRentalPeriod = "El perÃ­odo mÃ¡ximo debe ser igual o mayor que el mÃ­nimo";
  }

  if (!data.address) {
    errors.address = "Selecciona una direcciÃ³n de recogida";
  }

  if (data.photos.length === 0) {
    errors.photos = "AÃ±ade al menos una foto del producto";
  }

  return errors;
}

export { INITIAL_FORM, INITIAL_STATE, STEP_LABELS, formReducer, validateForm };
export type { FormAction, FormErrors, FormState, SubmitStep };
