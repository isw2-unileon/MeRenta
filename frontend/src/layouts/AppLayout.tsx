import { Outlet } from "react-router-dom";
import { NavbarAuth } from "@/components/layout/NavbarAuth";
import { Footer } from "@/components/layout/Footer";

/**
 * Layout for authenticated pages with navbar and footer.
 * @returns The app layout with a nested route outlet.
 */
function AppLayout() {
  return (
    <>
      <NavbarAuth />
      <main className="pt-navbar">
        <Outlet />
      </main>
      <Footer />
    </>
  );
}

export { AppLayout };
