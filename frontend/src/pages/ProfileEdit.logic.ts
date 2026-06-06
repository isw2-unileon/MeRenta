// State models, reducers and helpers for the profile-edit page: profile fields,
// review summary and the address book. Kept UI-free for easy unit testing.
import type { AddressResponse, CreateAddressRequest } from "@/types/address";
import type { CustomerPublic } from "@/types/customer";
import type { ReceivedReviewsResponseBase } from "@/components/profile/profileShared";

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

/** Returns a blank address draft (country defaulted to Spain). */
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

/** Reduces review summary fetch actions into the next state. */
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

/** Builds the initial profile-form state, prefilled from the user when present. */
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

/** Reduces profile-form actions (field edits, avatar, messages) into the next state. */
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

/** Reduces address-book actions (load, edit, save, delete) into the next state. */
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

/** Converts a stored address into an editable draft for the form. */
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

/** Formats an address as a one-line "street number, floor" summary. */
function formatAddress(address: AddressResponse) {
  return `${address.street} ${address.number}${address.floor ? `, ${address.floor}` : ""}`;
}

/** Validates an address draft, returning a map of required-field errors. */
function validateAddressDraft(draft: CreateAddressRequest) {
  const errors: Partial<CreateAddressRequest> = {};
  if (!draft.street.trim()) errors.street = "Obligatorio";
  if (!draft.number.trim()) errors.number = "Obligatorio";
  if (!draft.city.trim()) errors.city = "Obligatorio";
  if (!draft.province.trim()) errors.province = "Obligatorio";
  if (!draft.postal_code.trim()) errors.postal_code = "Obligatorio";
  return errors;
}

export {
  initialReviewsState,
  createEmptyAddress,
  initialAddressState,
  reviewsReducer,
  createInitialProfileState,
  profileReducer,
  addressReducer,
  addressToDraft,
  formatAddress,
  validateAddressDraft,
};
export type {
  AddressAction,
  AddressState,
  ProfileAction,
  ProfileState,
  ReceivedReviewsResponse,
  ReviewsAction,
  ReviewsState,
};
