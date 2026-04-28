import { ErrorPage } from "@/components/ui/ErrorPage";

function NotFound() {
  return <ErrorPage errorCode={404} />;
}

export { NotFound };
