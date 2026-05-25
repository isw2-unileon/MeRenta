import { Outlet } from "react-router-dom";

/**
 * Minimal layout with no chrome for standalone pages.
 * @returns The blank layout containing the nested outlet.
 */
function BlankLayout() {
  return (
    <main>
      <Outlet />
    </main>
  );
}

export { BlankLayout };
