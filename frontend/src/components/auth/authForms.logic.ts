interface LoginFormData {
  email: string;
  password: string;
}

interface RegisterFormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  repeatPassword: string;
}

function validateLogin(data: LoginFormData): string {
  if (!data.email.trim()) return "El email es requerido";
  if (!data.password) return "La contraseÃ±a es requerida";
  return "";
}

function normalizeLoginPayload(data: LoginFormData) {
  return {
    email: data.email.trim(),
    password: data.password,
  };
}

function validateRegister(data: RegisterFormData): string {
  if (!data.firstName.trim() || !data.lastName.trim()) return "El nombre es requerido";
  if (!data.email.trim()) return "El email es requerido";
  if (data.password.length < 8) return "La contraseÃ±a debe tener al menos 8 caracteres";
  if (data.password !== data.repeatPassword) return "Las contraseÃ±as no coinciden";
  return "";
}

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
