import { Outlet } from "react-router-dom";
import { NavbarPublic } from "@/components/layout/NavbarPublic";
import { Footer } from "@/components/layout/Footer";

/**
 * Layout for public pages with marketing navigation and footer.
 * @returns The public layout with a nested route outlet.
 */
function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <NavbarPublic />
      <main className="pt-navbar flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

export { PublicLayout };
