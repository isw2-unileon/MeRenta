import { Outlet } from "react-router-dom";

function BlankLayout() {
  return (
    <main>
      <Outlet />
    </main>
  );
}

export { BlankLayout };
