import { Outlet } from "react-router-dom";
import { NavbarAuth } from "@/components/layout/NavbarAuth";

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
