import { Outlet } from "react-router-dom";
import { NavbarPublic } from "@/components/layout/NavbarPublic";
import { Footer } from "@/components/layout/Footer";

/**
 * Layout for public pages with marketing navigation and footer.
 * @returns The public layout with a nested route outlet.
 */
function PublicLayout() {
  return (
    <>
      <NavbarPublic />
      <main className="pt-navbar">
        <Outlet />
      </main>
      <Footer />
    </>
  );
}

export { PublicLayout };
