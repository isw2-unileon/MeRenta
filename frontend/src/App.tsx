import { RouterProvider } from "react-router-dom";
import { router } from "@/router";

/**
 * Renders the application-level router.
 * @returns The router provider configured for the app.
 */
function App() {
  return <RouterProvider router={router} />;
}

export { App };
