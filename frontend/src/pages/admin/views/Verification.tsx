import { useCallback, useEffect, useReducer, useState } from "react";
import { Check, X } from "lucide-react";

import type { VerificationStatus } from "@/types/customer";
import type { AdminVerificationListResponse, AdminVerificationRequest } from "@/types/admin";
import { GREEN } from "@/components/admin/adminTokens";
import { getAdminData, sendAdminMutation } from "@/components/admin/adminApi";
import { fmtDate } from "@/components/admin/adminFormat";
import {
  Avatar,
  Badge,
  Card,
  ConfirmModal,
  FilterPills,
  Pagination,
  SectionTitle,
  TableSkeleton,
} from "@/components/admin/adminUi";

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

/** Returns the uppercase initials for a verification-queue row. */
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

/** Reduces verification-queue fetch and optimistic decision actions. */
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

/** Fetches a page of verification requests filtered by queue status. */
function fetchVerification(status: QueueStatus, page: number): Promise<AdminVerificationListResponse> {
  const params = new URLSearchParams({ status, page: String(page), limit: String(LIMIT) });
  return getAdminData<AdminVerificationListResponse>(
    `/api/admin/verification?${params.toString()}`,
    "Error al cargar la cola de verificación"
  );
}

/** Submits an admin verification decision (verified/rejected) for a customer. */
function updateVerification(customerId: string, status: DecisionStatus): Promise<void> {
  return sendAdminMutation(
    `/api/admin/verification/${customerId}`,
    "PATCH",
    { status },
    "Error al actualizar la verificación"
  );
}

/** Green check or grey cross indicating whether a requirement is met. */
function CheckMark({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-flex size-6 items-center justify-center rounded-full ${
        ok ? "bg-emerald-50 text-emerald-600" : "bg-neutral-100 text-neutral-300"
      }`}
      aria-label={ok ? "Sí" : "No"}
      title={ok ? "Sí" : "No"}
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

/**
 * Admin verification view — paginated queue of badge requests with approve /
 * reject actions guarded by a confirmation modal.
 */
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
        error: err instanceof Error ? err.message : "Error al actualizar la verificación",
      });
      load();
    }
  }

  const { requests, total, loading, error } = state;

  return (
    <div className="space-y-4">
      <FilterPills
        options={FILTER_OPTIONS}
        value={filters.status}
        onChange={handleStatusFilter}
      />

      <Card className="overflow-hidden">
        <div className="border-b border-neutral-100 px-5 py-4">
          <SectionTitle
            title="Verificación de perfil"
            sub={loading ? "Cargando..." : `${total.toLocaleString("es-ES")} solicitudes`}
          />
        </div>

        {error && <p className="px-5 py-4 text-sm text-red-600">{error}</p>}

        {!error && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-left text-xs text-neutral-400">
                <th className="px-5 py-3 font-medium">Usuario</th>
                <th className="px-5 py-3 font-medium">Teléfono</th>
                <th className="px-5 py-3 font-medium">Foto</th>
                <th className="px-5 py-3 font-medium">Dirección</th>
                <th className="hidden px-5 py-3 font-medium lg:table-cell">Solicitud</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <TableSkeleton
                  rows={5}
                  cols={7}
                />
              )}

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

        {!loading && (
          <Pagination
            page={filters.page}
            total={total}
            limit={LIMIT}
            onPage={handlePage}
          />
        )}
      </Card>

      {pending && (
        <ConfirmModal
          message={`¿Quieres ${pending.status === "verified" ? "aprobar" : "rechazar"} el badge verificado de ${pending.userName}?`}
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
