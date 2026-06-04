import { Clock } from "lucide-react";
import { useSearchParams } from "react-router-dom";

/**
 * Shown when the user's account has been temporarily suspended.
 * Reads the optional `until` query-param (ISO-8601) to display the end date.
 */
function Suspended() {
  const [params] = useSearchParams();
  const untilRaw = params.get("until");

  const untilDate = untilRaw ? new Date(untilRaw) : null;
  const isExpired = untilDate ? untilDate < new Date() : false;

  const formattedDate = untilDate
    ? untilDate.toLocaleDateString("es-ES", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-stone-50 px-4 text-center">
      <div className="mb-6 flex size-16 items-center justify-center rounded-full bg-amber-100">
        <Clock
          size={32}
          className="text-amber-600"
        />
      </div>

      <h1 className="text-2xl font-bold text-neutral-900">Cuenta suspendida</h1>

      {isExpired ? (
        <p className="mt-3 max-w-md text-neutral-500">
          Tu periodo de suspensión ha finalizado, pero tu cuenta sigue sin estar activa. Contacta con nuestro equipo de
          soporte para que lo revisemos.
        </p>
      ) : formattedDate ? (
        <p className="mt-3 max-w-md text-neutral-500">
          Tu cuenta ha sido suspendida temporalmente.{" "}
          <span className="font-medium text-neutral-700">La suspensión finaliza el {formattedDate}.</span> Hasta
          entonces no podrás acceder a MeRenta.
        </p>
      ) : (
        <p className="mt-3 max-w-md text-neutral-500">
          Tu cuenta ha sido suspendida temporalmente. Contacta con soporte para conocer más detalles.
        </p>
      )}

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

export { Suspended };
