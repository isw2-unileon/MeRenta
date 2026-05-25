import { ErrorPage } from "@/components/ui/ErrorPage";

/**
 * Displays the 404 error page.
 * @returns The not-found error layout.
 */
function NotFound() {
  return <ErrorPage errorCode={404} />;
}

export { NotFound };
