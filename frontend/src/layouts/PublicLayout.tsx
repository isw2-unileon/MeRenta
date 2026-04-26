import { Outlet } from "react-router-dom";
import { NavbarPublic } from "@/components/layout/NavbarPublic";
import { Footer } from "@/components/layout/Footer";

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
