import { Outlet } from "react-router-dom";
import { NavbarAuth } from "@/components/layout/NavbarAuth";
import { Footer } from "@/components/layout/Footer";

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
