import { ShieldOff } from "lucide-react";

/**
 * Shown when the user's account has been permanently banned.
 */
function Banned() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-stone-50 px-4 text-center">
      <div className="mb-6 flex size-16 items-center justify-center rounded-full bg-red-100">
        <ShieldOff
          size={32}
          className="text-red-600"
        />
      </div>

      <h1 className="text-2xl font-bold text-neutral-900">Cuenta bloqueada</h1>

      <p className="mt-3 max-w-md text-neutral-500">
        Tu cuenta ha sido bloqueada permanentemente por incumplir los términos de uso de MeRenta. Si crees que es un
        error, contacta con nuestro equipo de soporte.
      </p>

      <a
        href="mailto:soporte@merenta.es"
        className="mt-6 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white"
        style={{ backgroundColor: "#15734f" }}
      >
        Contactar con soporte
      </a>
    </div>
  );
}

export { Banned };
