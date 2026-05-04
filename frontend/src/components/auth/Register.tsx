import { useState, useContext } from "react";
import { Eye, EyeOff } from "lucide-react";
import { AuthContext } from "@/context/AuthContext";

type AuthView = "login" | "register" | "forgot";

export function Register({ onSwitch }: { onSwitch: (v: AuthView) => void }) {
  const { register, isLoading } = useContext(AuthContext);
  
  const [showPassword, setShowPassword] = useState(false);
  const [showRepeat, setShowRepeat] = useState(false);
  const [error, setError] = useState<string>("");
  
  // Form state
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    repeatPassword: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    const fieldMap: Record<string, keyof typeof formData> = {
      "register-name": "firstName",
      "register-last-name": "lastName",
      "register-email": "email",
      "register-password": "password",
      "register-repeat-password": "repeatPassword",
    };
    
    const field = fieldMap[id];
    if (field) {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validation
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setError("El nombre es requerido");
      return;
    }

    if (!formData.email.trim()) {
      setError("El email es requerido");
      return;
    }

    if (formData.password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres");
      return;
    }

    if (formData.password !== formData.repeatPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    try {
      await register({
        first_name: formData.firstName,
        last_name: formData.lastName,
        email: formData.email,
        password: formData.password,
        confirm_password: formData.repeatPassword,
      });
      
      // Success - switch to login
      setError("");
      setFormData({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        repeatPassword: "",
      });
      onSwitch("login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrar");
    }
  };

  return (
    <div className="flex min-h-9/10 flex-col justify-between">
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
            {error}
          </div>
        )}

        <div>
          <label
            className="label-auth required"
            htmlFor="register-name"
          >
            Nombre
          </label>
          <input
            id="register-name"
            className="input-auth"
            type="text"
            placeholder="Tu nombre"
            autoComplete="given-name"
            value={formData.firstName}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label
            className="label-auth required"
            htmlFor="register-last-name"
          >
            Apellido
          </label>
          <input
            id="register-last-name"
            className="input-auth"
            type="text"
            placeholder="Tu apellido"
            autoComplete="family-name"
            value={formData.lastName}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label
            className="label-auth required"
            htmlFor="register-email"
          >
            Email
          </label>
          <input
            id="register-email"
            className="input-auth"
            type="email"
            placeholder="tu@email.com"
            autoComplete="email"
            value={formData.email}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label
            className="label-auth required"
            htmlFor="register-password"
          >
            Contraseña
          </label>

          <div className="relative">
            <input
              id="register-password"
              className="input-auth pr-12"
              type={showPassword ? "text" : "password"}
              placeholder="Crea una contraseña"
              autoComplete="new-password"
              value={formData.password}
              onChange={handleChange}
              required
            />

            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="text-subtle hover:text-primary absolute top-1/2 right-4 size-6 -translate-y-1/2 p-0"
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            </button>
          </div>
        </div>

        <div>
          <label
            className="label-auth required"
            htmlFor="register-repeat-password"
          >
            Repetir contraseña
          </label>

          <div className="relative">
            <input
              id="register-repeat-password"
              className="input-auth pr-12"
              type={showRepeat ? "text" : "password"}
              placeholder="Repite la contraseña"
              autoComplete="new-password"
              value={formData.repeatPassword}
              onChange={handleChange}
              required
            />

            <button
              type="button"
              onClick={() => setShowRepeat((value) => !value)}
              className="text-subtle hover:text-primary absolute top-1/2 right-4 size-6 -translate-y-1/2 p-0"
              aria-label={showRepeat ? "Ocultar contraseña repetida" : "Mostrar contraseña repetida"}
            >
              {showRepeat ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            </button>
          </div>
        </div>

        <button
          className="btn-auth-submit"
          type="submit"
          disabled={isLoading}
        >
          {isLoading ? "Creando cuenta..." : "Crear cuenta"}
        </button>
      </form>

      <div className="mt-5 flex justify-center gap-3">
        <p className="auth-secondary-text">¿Ya tienes cuenta?</p>

        <button
          type="button"
          onClick={() => onSwitch("login")}
          className="p-0"
        >
          <p className="auth-link">Inicia sesión</p>
        </button>
      </div>
    </div>
  );
}
