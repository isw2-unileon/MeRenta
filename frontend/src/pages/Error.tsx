import { useState } from "react";
import { ErrorPage } from "../components/ui/ErrorPage";

type ErrorCode = 404 | 403 | 500;

function Error() {
  const [errorCode, setErrorCode] = useState<ErrorCode>(404);

  return (
    <main className="px-layout-margin min-h-dvh py-16">
      <div className="mb-8 flex gap-3">
        {[404, 500, 403].map((code) => (
          <button
            key={code}
            type="button"
            className={`btn--sm ${errorCode === code ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setErrorCode(code as ErrorCode)}
          >
            Error {code}
          </button>
        ))}
      </div>

      <section className="flex justify-center">
        <ErrorPage errorCode={errorCode} />
      </section>
    </main>
  );
}

export { Error };
