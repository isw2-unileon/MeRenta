import type { ReactNode } from "react";

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

export { Card, Badge, Avatar, SectionTitle, ConfirmModal };
