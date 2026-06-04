import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Avatar, Badge, Card, ConfirmModal, FilterPills, Pagination, SectionTitle, TableSkeleton } from "@/components/admin/adminUi";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: ReturnType<typeof createRoot> | null = null;

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = null;
  document.body.innerHTML = "";
});

function render(ui: ReactNode) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(ui);
  });
  return container;
}

describe("adminUi", () => {
  it("renders Card and SectionTitle slots", () => {
    const container = render(
      <Card className="extra-card">
        <SectionTitle
          title="Usuarios"
          sub="Activos y suspendidos"
          action={<button type="button">Exportar</button>}
        />
      </Card>
    );

    expect(container.textContent).toContain("Usuarios");
    expect(container.textContent).toContain("Activos y suspendidos");
    expect(container.textContent).toContain("Exportar");
    expect(container.firstElementChild?.className).toContain("extra-card");
  });

  it("renders initials in Avatar with the requested size", () => {
    const container = render(
      <Avatar
        initials="DP"
        size={40}
      />
    );

    const avatar = container.firstElementChild as HTMLElement;
    expect(avatar.textContent).toBe("DP");
    expect(avatar.style.width).toBe("40px");
    expect(avatar.style.height).toBe("40px");
  });

  it("renders Badge content", () => {
    const container = render(<Badge color="red">bloqueado</Badge>);

    expect(container.textContent).toBe("bloqueado");
  });

  it("applies green Badge inline brand colors", () => {
    const container = render(<Badge color="green">activo</Badge>);
    const badge = container.firstElementChild as HTMLElement;

    expect(badge.textContent).toBe("activo");
    expect(badge.style.backgroundColor).not.toBe("");
    expect(badge.style.color).not.toBe("");
  });

  it("calls FilterPills with the selected value", () => {
    const onChange = vi.fn();
    const container = render(
      <FilterPills
        options={[
          { value: "all", label: "Todos" },
          { value: "open", label: "Abiertos" },
        ]}
        value="all"
        onChange={onChange}
      />
    );

    const buttons = container.querySelectorAll("button");
    expect(buttons[0]?.style.backgroundColor).not.toBe("");
    act(() => {
      buttons[1]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onChange).toHaveBeenCalledWith("open");
  });

  it("hides Pagination when there is a single page", () => {
    const container = render(
      <Pagination
        page={1}
        total={10}
        limit={20}
        onPage={() => undefined}
      />
    );

    expect(container.textContent).toBe("");
  });

  it("calls Pagination handlers", () => {
    const onPage = vi.fn();
    const container = render(
      <Pagination
        page={2}
        total={50}
        limit={20}
        onPage={onPage}
      />
    );

    const buttons = container.querySelectorAll("button");
    act(() => {
      buttons[0]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      buttons[1]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onPage).toHaveBeenNthCalledWith(1, 1);
    expect(onPage).toHaveBeenNthCalledWith(2, 3);
  });

  it("disables Pagination edges", () => {
    const onPage = vi.fn();
    const container = render(
      <Pagination
        page={1}
        total={50}
        limit={20}
        onPage={onPage}
      />
    );

    const buttons = container.querySelectorAll("button");
    expect(buttons[0]?.disabled).toBe(true);
    expect(buttons[1]?.disabled).toBe(false);
  });

  it("calls ConfirmModal actions", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const container = render(
      <ConfirmModal
        message="Eliminar producto?"
        confirmLabel="Eliminar"
        dangerous
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    const buttons = container.querySelectorAll("button");
    act(() => {
      buttons[0]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      buttons[1]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("renders TableSkeleton cells", () => {
    const container = render(
      <table>
        <tbody>
          <TableSkeleton
            rows={2}
            cols={3}
          />
        </tbody>
      </table>
    );

    expect(container.querySelectorAll("tr")).toHaveLength(2);
    expect(container.querySelectorAll("td[aria-label='Cargando']")).toHaveLength(6);
  });
});
