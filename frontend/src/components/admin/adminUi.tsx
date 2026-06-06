import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { GREEN, MINT, PASTELS } from "@/components/admin/adminTokens";

// ── Types ─────────────────────────────────────────────────────────────────────
type BadgeColor = "gray" | "green" | "amber" | "red" | "blue" | "purple";

// ── Card ─────────────────────────────────────────────────────────────────────

interface CardProps {
  children: ReactNode;
  className?: string;
}

/**
 * Standard content card used throughout the admin panel.
 */
function Card({ children, className = "" }: CardProps) {
  return <div className={`rounded-xl border border-neutral-200 bg-white ${className}`}>{children}</div>;
}

// ── Badge ─────────────────────────────────────────────────────────────────────

const BADGE_MAP: Record<BadgeColor, string> = {
  gray: "bg-neutral-100 text-neutral-600",
  green: "",
  amber: "bg-amber-100 text-amber-700",
  red: "bg-red-100 text-red-700",
  blue: "bg-blue-100 text-blue-700",
  purple: "bg-violet-100 text-violet-700",
};

interface BadgeProps {
  children: ReactNode;
  color?: BadgeColor;
}

/**
 * Small pill badge for statuses and labels.
 */
function Badge({ children, color = "gray" }: BadgeProps) {
  const greenStyle = color === "green" ? { backgroundColor: MINT, color: GREEN } : {};
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        color === "green" ? "" : BADGE_MAP[color]
      }`}
      style={greenStyle}
    >
      {children}
    </span>
  );
}

// ── Avatar ────────────────────────────────────────────────────────────────────

interface AvatarProps {
  initials: string;
  index?: number;
  size?: number;
}

/**
 * Colored initials' avatar.
 */
function Avatar({ initials, index = 0, size = 36 }: AvatarProps) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-semibold text-neutral-700"
      style={{
        width: size,
        height: size,
        fontSize: size / 2.8,
        backgroundColor: PASTELS[index % PASTELS.length],
      }}
    >
      {initials}
    </div>
  );
}

// ── SectionTitle ──────────────────────────────────────────────────────────────

interface SectionTitleProps {
  title: string;
  sub?: string;
  action?: ReactNode;
}

/**
 * Section heading with optional subtitle and action slot.
 */
function SectionTitle({ title, sub, action }: SectionTitleProps) {
  return (
    <div className="mb-4 flex items-end justify-between">
      <div>
        <h2 className="text-xl font-bold text-neutral-900">{title}</h2>
        {sub && <p className="mt-0.5 text-sm text-neutral-500">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

// ── Stars ─────────────────────────────────────────────────────────────────────
// ── ComingSoon stub ────────────────────────────────────────────────────────────
// ── ConfirmModal ──────────────────────────────────────────────────────────────

interface ConfirmModalProps {
  message: string;
  confirmLabel?: string;
  /** Use true when the action is destructive (cancel, delete). */
  dangerous?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Lightweight confirmation dialog rendered as a fixed overlay.
 * Use before any irreversible admin action (status change, refund, etc.).
 */
function ConfirmModal({
  message,
  confirmLabel = "Confirmar",
  dangerous = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-6 shadow-xl">
        <p className="text-sm font-medium text-neutral-800">{message}</p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-lg py-2.5 text-sm font-semibold text-white"
            style={{ backgroundColor: dangerous ? "#dc2626" : GREEN }}
          >
            {confirmLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-neutral-200 py-2.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── FilterPills ───────────────────────────────────────────────────────────────

interface FilterPillsProps<V extends string> {
  options: readonly { value: V; label: string }[];
  value: V;
  onChange: (value: V) => void;
}

/**
 * Row of rounded filter pills; the selected one is highlighted in brand green.
 */
function FilterPills<V extends string>({ options, value, onChange }: FilterPillsProps<V>) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className="rounded-full border px-3.5 py-1.5 text-sm font-medium transition"
          style={
            value === option.value
              ? { backgroundColor: GREEN, color: "#fff", borderColor: GREEN }
              : { borderColor: "#e5e7eb", color: "#525252" }
          }
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

// ── Pagination ────────────────────────────────────────────────────────────────

interface PaginationProps {
  page: number;
  total: number;
  limit: number;
  onPage: (page: number) => void;
}

/**
 * Footer pager for admin tables. Renders nothing when there is a single page.
 */
function Pagination({ page, total, limit, onPage }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between border-t border-neutral-100 px-5 py-3 text-sm text-neutral-500">
      <span>
        {(page - 1) * limit + 1}–{Math.min(page * limit, total)} de {total.toLocaleString("es-ES")}
      </span>
      <div className="flex gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          aria-label="Página anterior"
          className="rounded px-2 py-1 hover:bg-neutral-50 disabled:opacity-40"
        >
          Anterior
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
          aria-label="Página siguiente"
          className="rounded px-2 py-1 hover:bg-neutral-50 disabled:opacity-40"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}

// ── Dropdown ──────────────────────────────────────────────────────────────────

interface DropdownProps {
  /** Accessible label for the trigger button. */
  ariaLabel: string;
  /** Trigger button content (e.g. an icon or a label). */
  button: ReactNode;
  /** Trigger button classes. Defaults to a subtle three-dot icon button. */
  buttonClassName?: string;
  /** Which trigger edge the panel aligns to. Defaults to "right". */
  align?: "left" | "right";
  /** Extra classes for the floating panel (e.g. min-width / padding). */
  panelClassName?: string;
  /** Called whenever the menu closes (useful to reset internal state). */
  onClose?: () => void;
  /** Panel content; receives a `close` callback to dismiss the menu. */
  children: (close: () => void) => ReactNode;
}

/**
 * Accessible dropdown menu whose panel is rendered in a portal with fixed
 * positioning. Because it escapes the DOM flow it is never clipped by an
 * ancestor `overflow-hidden` (e.g. a table card), and it flips above the
 * trigger when there is not enough room below — so menus on the last rows of a
 * table stay fully visible. Closes on outside click, Escape, and scroll-away.
 */
function Dropdown({
  ariaLabel,
  button,
  buttonClassName = "rounded p-1 text-neutral-400 hover:text-neutral-700",
  align = "right",
  panelClassName = "min-w-36 py-1",
  onClose,
  children,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    onClose?.();
  }, [onClose]);

  // Effect Event wrapper so the document listeners below capture the latest
  // `close` without `close` being a reactive dependency (avoids re-subscribing
  // on every parent render).
  const onDismiss = useEffectEvent(close);

  // Reset position so the panel renders hidden until measured (no flash at the
  // previous location when reopening).
  const openMenu = useCallback(() => {
    setCoords(null);
    setOpen(true);
  }, []);

  const reposition = useCallback(() => {
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;
    const rect = trigger.getBoundingClientRect();
    const { offsetHeight: h, offsetWidth: w } = panel;
    const gap = 4;
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropUp = spaceBelow < h + gap && rect.top > h + gap;
    const top = dropUp ? rect.top - h - gap : rect.bottom + gap;
    const rawLeft = align === "right" ? rect.right - w : rect.left;
    const left = Math.min(Math.max(8, rawLeft), window.innerWidth - w - 8);
    setCoords({ top, left });
  }, [align]);

  useLayoutEffect(() => {
    if (!open) return;
    reposition();
    const onScroll = () => reposition();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    let observer: ResizeObserver | undefined;
    if (panelRef.current && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => reposition());
      observer.observe(panelRef.current);
    }
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      observer?.disconnect();
    };
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      onDismiss();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onDismiss();
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={buttonClassName}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => (open ? close() : openMenu())}
      >
        {button}
      </button>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            role="menu"
            className={`fixed z-50 rounded-lg border border-neutral-200 bg-white shadow-md ${panelClassName}`}
            style={{
              top: coords?.top ?? 0,
              left: coords?.left ?? 0,
              visibility: coords ? "visible" : "hidden",
            }}
          >
            {children(close)}
          </div>,
          document.body
        )}
    </>
  );
}

// ── TableSkeleton ─────────────────────────────────────────────────────────────

interface TableSkeletonProps {
  rows: number;
  cols: number;
}

/**
 * Placeholder `<tr>` rows shown while an admin table is loading.
 * Render inside a `<tbody>`.
 */
function TableSkeleton({ rows, cols }: TableSkeletonProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr
          key={i}
          className="border-b border-neutral-50"
        >
          {Array.from({ length: cols }).map((__, j) => (
            <td
              key={j}
              aria-label="Cargando"
              className="px-5 py-4"
            >
              <div
                aria-hidden="true"
                className="h-4 w-24 animate-pulse rounded bg-neutral-100"
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export { Card, Badge, Avatar, SectionTitle, ConfirmModal, Dropdown, FilterPills, Pagination, TableSkeleton };
