import { Error } from "./Error.tsx";

type ErrorCode = 404 | 403 | 500;

interface ErrorPageProps {
  errorCode: ErrorCode;
}

/**
 * Wraps the error card in a centered layout with a back action.
 * @param errorCode Error code forwarded to the error card.
 * @returns The error page layout.
 */
function ErrorPage({ errorCode }: ErrorPageProps) {
  return (
    <div className="flex justify-center">
      <Error
        code={errorCode}
        onAction={() => window.history.back()}
      />
    </div>
  );
}

export { ErrorPage };
