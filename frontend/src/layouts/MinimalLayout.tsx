import { Outlet } from "react-router-dom";
import { NavbarAuth } from "@/components/layout/NavbarAuth";

/**
 * Slim authenticated layout without footer.
 * @returns The minimal layout with a navbar and outlet.
 */
function MinimalLayout() {
  return (
    <>
      <NavbarAuth />
      <main className="pt-navbar">
        <Outlet />
      </main>
    </>
  );
}

export { MinimalLayout };
