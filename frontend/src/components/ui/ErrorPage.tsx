import { Error } from "./Error.tsx";

type ErrorCode = 404 | 403 | 500;

interface ErrorPageProps {
  errorCode: ErrorCode;
}

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
