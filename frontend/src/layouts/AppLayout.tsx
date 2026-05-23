import { Outlet } from "react-router-dom";
import { NavbarAuth } from "@/components/layout/NavbarAuth";
import { Footer } from "@/components/layout/Footer";

/**
 * Layout for authenticated pages with navbar and footer.
 * @returns The app layout with a nested route outlet.
 */
function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <NavbarAuth />
      <main className="pt-navbar flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

export { AppLayout };
