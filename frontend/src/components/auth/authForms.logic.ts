/** Raw values collected by the login form. */
interface LoginFormData {
  email: string;
  password: string;
}

/** Raw values collected by the registration form. */
interface RegisterFormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  repeatPassword: string;
}

/**
 * Validates the login form, returning the first error message in Spanish, or an
 * empty string when the data is valid.
 */
function validateLogin(data: LoginFormData): string {
  if (!data.email.trim()) return "El email es requerido";
  if (!data.password) return "La contraseña es requerida";
  return "";
}

/** Maps login form data to the trimmed payload sent to the login endpoint. */
function normalizeLoginPayload(data: LoginFormData) {
  return {
    email: data.email.trim(),
    password: data.password,
  };
}

/**
 * Validates the registration form, returning the first error message in
 * Spanish, or an empty string when the data is valid.
 */
function validateRegister(data: RegisterFormData): string {
  if (!data.firstName.trim() || !data.lastName.trim()) return "El nombre es requerido";
  if (!data.email.trim()) return "El email es requerido";
  if (data.password.length < 8) return "La contraseña debe tener al menos 8 caracteres";
  if (data.password !== data.repeatPassword) return "Las contraseñas no coinciden";
  return "";
}

/**
 * Maps registration form data to the snake_case payload expected by the
 * register endpoint.
 */
function normalizeRegisterPayload(data: RegisterFormData) {
  return {
    first_name: data.firstName.trim(),
    last_name: data.lastName.trim(),
    email: data.email.trim(),
    password: data.password,
    confirm_password: data.repeatPassword,
  };
}

export { validateLogin, normalizeLoginPayload, validateRegister, normalizeRegisterPayload };
export type { LoginFormData, RegisterFormData };
