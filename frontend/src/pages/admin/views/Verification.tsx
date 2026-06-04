import { useCallback, useEffect, useReducer, useState } from "react";
import { Check, X } from "lucide-react";

import type { ApiResponse } from "@/types/common";
import type { VerificationStatus } from "@/types/customer";
import type { AdminVerificationListResponse, AdminVerificationRequest } from "@/types/admin";
import { GREEN } from "@/pages/admin/components/adminTokens";
import { Avatar, Badge, Card, ConfirmModal, SectionTitle } from "@/pages/admin/components/adminUi";

const LIMIT = 20;

type QueueStatus = Exclude<VerificationStatus, "none">;
type DecisionStatus = Extract<VerificationStatus, "verified" | "rejected">;

const FILTER_OPTIONS: { value: QueueStatus; label: string }[] = [
  { value: "pending", label: "Pendientes" },
  { value: "verified", label: "Verificados" },
  { value: "rejected", label: "Rechazados" },
];

const STATUS_LABELS: Record<QueueStatus, string> = {
  pending: "pendiente",
  verified: "verificado",
  rejected: "rechazado",
};

const STATUS_BADGE_COLORS: Record<QueueStatus, "amber" | "green" | "red"> = {
  pending: "amber",
  verified: "green",
  rejected: "red",
};

function fmtDate(iso: string): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function userInitials(u: AdminVerificationRequest): string {
  return `${u.first_name[0] ?? ""}${u.last_name[0] ?? ""}`.toUpperCase();
}

interface VerificationState {
  requests: AdminVerificationRequest[];
  total: number;
  loading: boolean;
  error: string | null;
}

type VerificationAction =
  | { type: "fetch_start" }
  | { type: "fetch_success"; requests: AdminVerificationRequest[]; total: number }
  | { type: "fetch_error"; error: string }
  | { type: "patch_status"; customerId: string; status: QueueStatus };

const initialState: VerificationState = { requests: [], total: 0, loading: true, error: null };

function verificationReducer(state: VerificationState, action: VerificationAction): VerificationState {
  switch (action.type) {
    case "fetch_start":
      return { ...state, loading: true, error: null };
    case "fetch_success":
      return { requests: action.requests, total: action.total, loading: false, error: null };
    case "fetch_error":
      return { ...state, loading: false, error: action.error };
    case "patch_status":
      return {
        ...state,
        requests: state.requests.map((request) =>
          request.customer_id === action.customerId ? { ...request, verification_status: action.status } : request
        ),
      };
  }
}

async function fetchVerification(status: QueueStatus, page: number): Promise<AdminVerificationListResponse> {
  const params = new URLSearchParams({ status, page: String(page), limit: String(LIMIT) });
  const res = await fetch(`/api/admin/verification?${params.toString()}`, { credentials: "include" });
  const json = (await res.json()) as ApiResponse<AdminVerificationListResponse>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.error ?? "Error al cargar la cola de verificacion");
  }
  return json.data;
}

async function updateVerification(customerId: string, status: DecisionStatus): Promise<void> {
  const res = await fetch(`/api/admin/verification/${customerId}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  const json = (await res.json()) as ApiResponse<unknown>;
  if (!res.ok || !json.success) {
    throw new Error(json.error ?? "Error al actualizar la verificacion");
  }
}

function CheckMark({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-flex size-6 items-center justify-center rounded-full ${
        ok ? "bg-emerald-50 text-emerald-600" : "bg-neutral-100 text-neutral-300"
      }`}
      aria-label={ok ? "Si" : "No"}
      title={ok ? "Si" : "No"}
    >
      {ok ? <Check size={14} /> : <X size={14} />}
    </span>
  );
}

interface PendingDecision {
  customerId: string;
  userName: string;
  status: DecisionStatus;
}

function Verification() {
  const [state, dispatch] = useReducer(verificationReducer, initialState);
  const [filters, setFilters] = useState({ status: "pending" as QueueStatus, page: 1 });
  const [pending, setPending] = useState<PendingDecision | null>(null);

  const load = useCallback(() => {
    dispatch({ type: "fetch_start" });
    fetchVerification(filters.status, filters.page)
      .then((data) => dispatch({ type: "fetch_success", requests: data.requests, total: data.total }))
      .catch((err: unknown) =>
        dispatch({
          type: "fetch_error",
          error: err instanceof Error ? err.message : "Error desconocido",
        })
      );
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  function handleStatusFilter(status: QueueStatus) {
    setFilters({ status, page: 1 });
  }

  function handlePage(page: number) {
    setFilters((current) => ({ ...current, page }));
  }

  async function confirmDecision() {
    if (!pending) return;
    const decision = pending;
    dispatch({ type: "patch_status", customerId: decision.customerId, status: decision.status });
    setPending(null);
    try {
      await updateVerification(decision.customerId, decision.status);
      window.dispatchEvent(new Event("merenta:verification-updated"));
      load();
    } catch (err) {
      dispatch({
        type: "fetch_error",
        error: err instanceof Error ? err.message : "Error al actualizar la verificacion",
      });
      load();
    }
  }

  const { requests, total, loading, error } = state;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {FILTER_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => handleStatusFilter(value)}
            className="rounded-full border px-3.5 py-1.5 text-sm font-medium transition"
            style={
              filters.status === value
                ? { backgroundColor: GREEN, color: "#fff", borderColor: GREEN }
                : { borderColor: "#e5e7eb", color: "#525252" }
            }
          >
            {label}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-neutral-100 px-5 py-4">
          <SectionTitle
            title="Verificacion de perfil"
            sub={loading ? "Cargando..." : `${total.toLocaleString("es-ES")} solicitudes`}
          />
        </div>

        {error && <p className="px-5 py-4 text-sm text-red-600">{error}</p>}

        {!error && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-left text-xs text-neutral-400">
                <th className="px-5 py-3 font-medium">Usuario</th>
                <th className="px-5 py-3 font-medium">Telefono</th>
                <th className="px-5 py-3 font-medium">Foto</th>
                <th className="px-5 py-3 font-medium">Direccion</th>
                <th className="hidden px-5 py-3 font-medium lg:table-cell">Solicitud</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <tr
                    key={i}
                    className="border-b border-neutral-50"
                  >
                    {Array.from({ length: 7 }).map((__, j) => (
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

              {!loading &&
                requests.map((request, i) => {
                  const userName = `${request.first_name} ${request.last_name}`.trim();
                  return (
                    <tr
                      key={request.customer_id}
                      className="border-b border-neutral-50 hover:bg-neutral-50"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          {request.avatar_url ? (
                            <img
                              src={request.avatar_url}
                              alt={userName}
                              className="size-9 shrink-0 rounded-full object-cover"
                            />
                          ) : (
                            <Avatar
                              initials={userInitials(request)}
                              index={i}
                            />
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-medium text-neutral-900">{userName}</p>
                            <p className="truncate text-xs text-neutral-400">{request.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-neutral-600">{request.phone || "-"}</td>
                      <td className="px-5 py-3.5">
                        <CheckMark ok={Boolean(request.avatar_url)} />
                      </td>
                      <td className="px-5 py-3.5">
                        <CheckMark ok={request.has_address} />
                      </td>
                      <td className="hidden px-5 py-3.5 text-neutral-500 lg:table-cell">
                        {fmtDate(request.requested_at)}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge color={STATUS_BADGE_COLORS[request.verification_status]}>
                          {STATUS_LABELS[request.verification_status]}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {request.verification_status === "pending" ? (
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                              style={{ backgroundColor: GREEN }}
                              onClick={() =>
                                setPending({ customerId: request.customer_id, userName, status: "verified" })
                              }
                            >
                              Aprobar
                            </button>
                            <button
                              type="button"
                              className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                              onClick={() =>
                                setPending({ customerId: request.customer_id, userName, status: "rejected" })
                              }
                            >
                              Rechazar
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-neutral-400">Resuelto</span>
                        )}
                      </td>
                    </tr>
                  );
                })}

              {!loading && requests.length === 0 && !error && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-10 text-center text-sm text-neutral-400"
                  >
                    No hay solicitudes en este estado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {totalPages > 1 && !loading && (
          <div className="flex items-center justify-between border-t border-neutral-100 px-5 py-3 text-sm text-neutral-500">
            <span>
              {(filters.page - 1) * LIMIT + 1}-{Math.min(filters.page * LIMIT, total)} de {total}
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                disabled={filters.page <= 1}
                onClick={() => handlePage(filters.page - 1)}
                aria-label="Pagina anterior"
                className="rounded px-2 py-1 hover:bg-neutral-50 disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={filters.page >= totalPages}
                onClick={() => handlePage(filters.page + 1)}
                aria-label="Pagina siguiente"
                className="rounded px-2 py-1 hover:bg-neutral-50 disabled:opacity-40"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </Card>

      {pending && (
        <ConfirmModal
          message={`Quieres ${pending.status === "verified" ? "aprobar" : "rechazar"} el badge verificado de ${pending.userName}?`}
          confirmLabel={pending.status === "verified" ? "Aprobar" : "Rechazar"}
          dangerous={pending.status === "rejected"}
          onConfirm={confirmDecision}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  );
}

export { Verification };
