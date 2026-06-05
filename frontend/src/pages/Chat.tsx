import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowRight, BadgeCheck, CheckCheck, Search, SendHorizontal, Trash2, X } from "lucide-react";

import type { ApiResponse } from "@/types/common";
import { useAuth } from "@/hooks/useAuth";
import {
  chatReducer,
  initialState,
  initialsFromName,
  type ChatWebSocketEvent,
  type ConversationResponse,
  type ConversationsResponse,
  type MessageResponse,
  type MessagesResponse,
} from "./Chat.logic";
import * as React from "react";

const chatTimeFormatter = new Intl.DateTimeFormat("es-ES", {
  hour: "2-digit",
  minute: "2-digit",
});
const conversationDayFormatter = new Intl.DateTimeFormat("es-ES", { weekday: "short" });
const dayLabelFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "long",
});
const CHAT_SKELETON_IDS = ["chat-skel-1", "chat-skel-2", "chat-skel-3", "chat-skel-4", "chat-skel-5"];

function formatChatTime(iso?: string): string {
  if (!iso) return "";
  return chatTimeFormatter.format(new Date(iso));
}

function formatConversationTime(iso?: string): string {
  if (!iso) return "";

  const date = new Date(iso);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) return formatChatTime(iso);

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Ayer";

  return conversationDayFormatter.format(date);
}

function dayLabel(iso?: string): string {
  if (!iso) return "Hoy";
  return dayLabelFormatter.format(new Date(iso));
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeoutID = window.setTimeout(resolve, ms);

    signal?.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timeoutID);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true }
    );
  });
}

async function apiGet<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { credentials: "include", signal });
  const json = (await res.json()) as ApiResponse<T>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message ?? json.error ?? "Error al cargar los datos");
  }
  return json.data;
}

async function apiGetWithRetry<T>(url: string, signal?: AbortSignal): Promise<T> {
  const delays = [700, 1400, 2500];

  const attemptFetch = async (attempt: number): Promise<T> => {
    try {
      return await apiGet<T>(url, signal);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") throw err;
      if (attempt < delays.length) {
        await wait(delays[attempt] ?? 0, signal);
        return attemptFetch(attempt + 1);
      }
      throw err instanceof Error ? err : new Error("Error al cargar los datos");
    }
  };

  return attemptFetch(0);
}

async function sendMessage(conversationID: string, body: string): Promise<MessageResponse> {
  const res = await fetch(`/api/conversations/${conversationID}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ body }),
  });
  const json = (await res.json()) as ApiResponse<MessageResponse>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message ?? json.error ?? "Error al enviar el mensaje");
  }
  return json.data;
}

async function deleteConversation(conversationID: string): Promise<void> {
  const res = await fetch(`/api/conversations/${conversationID}`, {
    method: "DELETE",
    credentials: "include",
  });
  const json = (await res.json()) as ApiResponse<{ deleted: boolean }>;
  if (!res.ok || !json.success) {
    throw new Error(json.message ?? json.error ?? "Error al eliminar la conversación");
  }
}

async function markConversationRead(conversationID: string): Promise<void> {
  await fetch(`/api/conversations/${conversationID}/read`, {
    method: "POST",
    credentials: "include",
  });
}

function buildWebSocketURL(conversationID: string): string {
  // In dev the Vite proxy (ws: true) forwards /api/* to the backend, so we connect
  // to the dev server origin and let the proxy handle the upgrade. This keeps the
  // connection same-origin and avoids a CSP violation for ws://localhost:8080.
  // In production, we use VITE_API_BASE_URL directly (cross-origin backend).
  // Authentication is handled via the HttpOnly cookie, which the browser sends
  // automatically on WebSocket connections — no token query-param needed.
  const apiBaseURL = import.meta.env.DEV
    ? window.location.origin
    : import.meta.env.VITE_API_BASE_URL.trim() || window.location.origin;
  const url = new URL(`/api/conversations/${conversationID}/ws`, apiBaseURL);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

function ChatAvatar({ name, image, small = false }: { name: string; image?: string; small?: boolean }) {
  const initials = initialsFromName(name);
  const size = small ? "size-7 text-[11px]" : "size-11 text-[14px]";

  if (image) {
    return (
      <img
        src={image}
        alt={name}
        className={`${size} shrink-0 rounded-full object-cover`}
      />
    );
  }

  return (
    <div className={`reviewer-avatar--blue flex shrink-0 items-center justify-center rounded-full font-bold ${size}`}>
      {initials}
    </div>
  );
}

function ConversationRow({
  conversation,
  active,
  unreadCount,
  selecting,
  selected,
  onOpen,
  onSelect,
}: {
  conversation: ConversationResponse;
  active: boolean;
  unreadCount: number;
  selecting: boolean;
  selected: boolean;
  onOpen: () => void;
  onSelect: () => void;
}) {
  const unread = unreadCount > 0;
  const unreadLabel = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <div
      className={`border-border-main relative grid h-auto w-full items-center gap-3 rounded-none border-b px-4 py-5 text-left transition-colors ${
        active ? "bg-page" : unread ? "bg-[#d6f0e6] hover:bg-[#c7eadc]" : "hover:bg-section-alt"
      }`}
      style={{ gridTemplateColumns: selecting ? "28px 44px minmax(0, 1fr) auto" : "44px minmax(0, 1fr) auto" }}
    >
      {active || unread ? <span className="bg-primary absolute top-0 bottom-0 left-0 w-1" /> : null}
      {selecting ? (
        <input
          type="checkbox"
          className="size-4 accent-[#dc2626]"
          aria-label={`Seleccionar conversación con ${conversation.other_user_name}`}
          checked={selected}
          onChange={onSelect}
        />
      ) : null}
      <button
        type="button"
        className="contents text-left"
        onClick={selecting ? onSelect : onOpen}
      >
        <ChatAvatar
          name={conversation.other_user_name}
          image={conversation.other_avatar_url}
        />
        <span className="min-w-0">
          <span className="flex items-center gap-1">
            <span className="text-ink block truncate text-[15px] font-bold">{conversation.other_user_name}</span>
            {conversation.other_user_verification_status === "verified" && (
              <BadgeCheck
                size={14}
                className="text-primary shrink-0"
                aria-label="Perfil verificado"
              />
            )}
          </span>
          <span className="text-primary block truncate text-[11px] font-medium">{conversation.item_title}</span>
          <span className={`${unread ? "text-ink font-medium" : "text-subtle"} text-card-loc block truncate`}>
            {conversation.last_message ?? "Sin mensajes todavía"}
          </span>
        </span>
      </button>
      <span className="flex flex-col items-end gap-2 self-start pt-1">
        <span className={`${unread ? "text-primary font-bold" : "text-footer-text"} text-[11px]`}>
          {formatConversationTime(conversation.last_message_at ?? conversation.updated_at)}
        </span>
        {unread ? (
          <span className="bg-primary flex min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] leading-5 font-bold text-white">
            {unreadLabel}
          </span>
        ) : null}
      </span>
    </div>
  );
}

function MessageBubble({ message, otherUser }: { message: MessageResponse; otherUser: ConversationResponse }) {
  const isMine = message.is_mine;

  return (
    <div className={`flex items-end gap-3 ${isMine ? "justify-end" : "justify-start"}`}>
      {!isMine ? (
        <ChatAvatar
          name={otherUser.other_user_name}
          image={otherUser.other_avatar_url}
          small
        />
      ) : null}

      <div className={`max-w-155 ${isMine ? "items-end" : "items-start"} flex flex-col gap-1`}>
        <div
          className={`rounded-2xl px-5 py-4 text-[14px] leading-relaxed shadow-sm ${
            isMine ? "bg-primary text-white" : "border-border-main bg-page text-ink border"
          }`}
        >
          {message.body}
        </div>
        <div className={`flex items-center gap-1 text-[11px] ${isMine ? "text-subtle" : "text-footer-text"}`}>
          {isMine ? (
            <CheckCheck
              size={14}
              className={message.is_read ? "text-[#1d9bf0]" : "text-subtle"}
            />
          ) : null}
          <span>{formatChatTime(message.created_at)}</span>
        </div>
      </div>
    </div>
  );
}

function ConversationList({
  conversations,
  loading,
  searchQuery,
  activeConversationID,
  unreadCountsByConversationID,
  selecting,
  selectedConversationIDs,
  onSearchChange,
  onOpen,
  onToggleSelecting,
  onToggleSelected,
  onDeleteSelected,
}: {
  conversations: ConversationResponse[];
  loading: boolean;
  searchQuery: string;
  activeConversationID?: string;
  unreadCountsByConversationID: Map<string, number>;
  selecting: boolean;
  selectedConversationIDs: Set<string>;
  onSearchChange: (value: string) => void;
  onOpen: (conversationID: string) => void;
  onToggleSelecting: () => void;
  onToggleSelected: (conversationID: string) => void;
  onDeleteSelected: () => void;
}) {
  const selectedCount = selectedConversationIDs.size;

  return (
    <aside className="border-border-main bg-page flex w-[320px] shrink-0 flex-col border-r">
      <div className="border-border-main border-b p-4">
        <h1 className="text-error-title font-semibold">Mensajes</h1>
        <label className="relative mt-5 mb-0 block">
          <Search
            size={16}
            className="text-placeholder pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
          />
          <input
            type="search"
            placeholder="Buscar conversación..."
            className="text-card-loc h-10 rounded-lg pl-10"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            className={`inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-[13px] font-bold transition-colors ${
              selecting
                ? "border border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]"
                : "border border-[#fecaca] bg-transparent text-[#b91c1c] hover:bg-[#fef2f2]"
            }`}
            onClick={onToggleSelecting}
          >
            <Trash2 size={15} />
            {selecting ? "Cancelar" : "Eliminar mensajes"}
          </button>
          {selecting ? (
            <button
              type="button"
              className="inline-flex h-9 items-center justify-center rounded-lg bg-[#dc2626] px-3 text-[13px] font-bold text-white transition-colors hover:bg-[#b91c1c] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={selectedCount === 0}
              onClick={onDeleteSelected}
            >
              Eliminar{selectedCount > 0 ? ` (${selectedCount})` : ""}
            </button>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="space-y-4">
            {CHAT_SKELETON_IDS.map((id) => (
              <div
                key={id}
                className="flex animate-pulse items-center gap-3"
              >
                <div className="bg-primary-light size-11 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="bg-border-main h-3 w-1/2 rounded" />
                  <div className="bg-border-main h-3 w-3/4 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : conversations.length > 0 ? (
          conversations.map((conversation) => (
            <ConversationRow
              key={conversation.conversation_id}
              conversation={conversation}
              active={conversation.conversation_id === activeConversationID}
              unreadCount={unreadCountsByConversationID.get(conversation.conversation_id) ?? 0}
              selecting={selecting}
              selected={selectedConversationIDs.has(conversation.conversation_id)}
              onOpen={() => onOpen(conversation.conversation_id)}
              onSelect={() => onToggleSelected(conversation.conversation_id)}
            />
          ))
        ) : (
          <p className="text-subtle p-5 text-[13px]">
            {searchQuery.trim() ? "No hay conversaciones que coincidan." : "Todavía no tienes conversaciones."}
          </p>
        )}
      </div>
    </aside>
  );
}

function ChatHeader({
  conversation,
  onViewProduct,
}: {
  conversation: ConversationResponse;
  onViewProduct: () => void;
}) {
  return (
    <header className="border-border-main bg-page h-error-icon flex shrink-0 items-center justify-between border-b px-6">
      <div className="flex items-center gap-3">
        <ChatAvatar
          name={conversation.other_user_name}
          image={conversation.other_avatar_url}
        />
        <div>
          <div className="flex items-center gap-1.5">
            <h2 className="text-[17px] font-semibold">{conversation.other_user_name}</h2>
            {conversation.other_user_verification_status === "verified" && (
              <BadgeCheck
                size={18}
                className="text-primary shrink-0"
                aria-label="Perfil verificado"
              />
            )}
          </div>
          <p className="bg-primary-light text-primary inline-flex max-w-90 truncate rounded-full px-2.5 py-0.5 text-[10px] font-medium">
            {conversation.item_title} · {Math.round(conversation.item_price)} EUR/día
          </p>
        </div>
      </div>

      <button
        type="button"
        className="text-primary hover:text-primary-dark h-auto gap-2 p-0 text-[13px] font-medium"
        onClick={onViewProduct}
      >
        Ver producto
        <ArrowRight size={15} />
      </button>
    </header>
  );
}

function MessagesPanel({
  conversation,
  messages,
  loadingMessages,
  error,
  messagesEndRef,
}: {
  conversation: ConversationResponse;
  messages: MessageResponse[];
  loadingMessages: boolean;
  error: string;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <>
      {error ? (
        <p className="border-border-main bg-error-danger text-report border-b px-6 py-3 text-[13px]">{error}</p>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <div className="mx-auto flex max-w-245 flex-col gap-5">
          <div className="flex justify-center">
            <span className="bg-ghost text-subtle rounded-full px-5 py-2 text-[11px]">
              {dayLabel(messages[0]?.created_at)}
            </span>
          </div>

          {loadingMessages ? (
            <div className="space-y-5">
              <div className="bg-border-main h-13 w-2/5 animate-pulse rounded-2xl" />
              <div className="bg-primary-light ml-auto h-13 w-1/2 animate-pulse rounded-2xl" />
            </div>
          ) : messages.length > 0 ? (
            messages.map((message) => (
              <MessageBubble
                key={message.message_id}
                message={message}
                otherUser={conversation}
              />
            ))
          ) : (
            <p className="text-subtle text-center text-[13px]">
              Empieza la conversación escribiendo el primer mensaje.
            </p>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
    </>
  );
}

function ChatComposer({
  draft,
  sending,
  onDraftChange,
  onSubmit,
}: {
  draft: string;
  sending: boolean;
  onDraftChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form
      className="border-border-main bg-page h-error-icon flex shrink-0 items-center gap-3 border-t px-4"
      onSubmit={onSubmit}
    >
      <input
        type="text"
        placeholder="Escribe un mensaje..."
        aria-label="Mensaje"
        className="bg-surface h-11 rounded-full px-5"
        value={draft}
        onChange={(event) => onDraftChange(event.target.value)}
      />
      <button
        type="submit"
        aria-label="Enviar mensaje"
        className="btn-primary size-11 shrink-0 rounded-full p-0"
        disabled={sending || draft.trim() === ""}
      >
        <SendHorizontal size={18} />
      </button>
    </form>
  );
}

function DeleteConversationDialog({
  count,
  deleting,
  onCancel,
  onConfirm,
}: {
  count: number;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (count === 0) return null;
  const label = count === 1 ? "la conversación seleccionada" : `las ${count} conversaciones seleccionadas`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-page border-border-main w-full max-w-100 rounded-lg border p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-ink text-logo-footer font-semibold">Eliminar conversaciones</h2>
            <p className="text-subtle mt-2 text-[14px]">¿Desea eliminar {label} de tu bandeja?</p>
          </div>
          <button
            type="button"
            className="text-subtle hover:bg-section-alt inline-flex size-8 shrink-0 items-center justify-center rounded-full"
            aria-label="Cerrar"
            onClick={onCancel}
            disabled={deleting}
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            className="btn-secondary btn--md"
            onClick={onCancel}
            disabled={deleting}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[#dc2626] px-4 text-[14px] font-bold text-white transition-colors hover:bg-[#b91c1c]"
            onClick={onConfirm}
            disabled={deleting}
          >
            {deleting ? "Eliminando..." : "Si, eliminar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Chat page hook — keeps all state, effects and handlers out of the render ──
function useChatPage(conversationId: string | undefined) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [state, dispatch] = useReducer(chatReducer, initialState);
  const [selectingConversations, setSelectingConversations] = useState(false);
  const [selectedConversationIDs, setSelectedConversationIDs] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingConversation, setDeletingConversation] = useState(false);

  const { conversations, messages, draft, searchQuery, loadingMessages } = state;
  const socketRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const currentUserID = user?.customer_id;

  const normalizeMessage = useCallback(
    (message: MessageResponse): MessageResponse =>
      currentUserID ? { ...message, is_mine: message.sender_id === currentUserID } : message,
    [currentUserID]
  );
  // Keep a ref so the WS effect can always call the latest normalizeMessage without
  // listing it as a dependency — avoids a spurious reconnect when auth finishes loading.
  const normalizeMessageRef = useRef(normalizeMessage);
  useEffect(() => {
    normalizeMessageRef.current = normalizeMessage;
  }, [normalizeMessage]);

  useEffect(() => {
    const controller = new AbortController();
    dispatch({ type: "error:clear" });

    apiGetWithRetry<ConversationsResponse>("/api/conversations", controller.signal)
      .then((data) => {
        dispatch({ type: "conversations:success", items: data.items });
        // If the user navigated directly to a conversation URL, clear its unread badge
        // immediately after load — no effect needed, the handler runs once here.
        if (conversationId) dispatch({ type: "conversation:open", conversationID: conversationId });
      })
      .catch((err: Error) => {
        if (err.name !== "AbortError") dispatch({ type: "conversations:error", message: err.message });
      });

    return () => controller.abort();
  }, [conversationId]);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.conversation_id === conversationId),
    [conversationId, conversations]
  );
  const activeConversationID = activeConversation?.conversation_id;

  const filteredConversations = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase("es-ES");
    if (!query) return conversations;
    return conversations.filter((c) => {
      const sellerName = c.other_user_name.toLocaleLowerCase("es-ES");
      const productTitle = c.item_title.toLocaleLowerCase("es-ES");
      return sellerName.includes(query) || productTitle.includes(query);
    });
  }, [conversations, searchQuery]);

  useEffect(() => {
    const intervalID = window.setInterval(() => {
      void apiGet<ConversationsResponse>("/api/conversations")
        .then((data) => dispatch({ type: "conversations:refresh", items: data.items, activeConversationID }))
        .catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(intervalID);
  }, [activeConversationID]);

  useEffect(() => {
    if (!activeConversationID) {
      dispatch({ type: "messages:reset" });
      return;
    }

    const controller = new AbortController();

    const loadMessages = async (showLoading: boolean) => {
      if (showLoading) dispatch({ type: "messages:loading" });
      try {
        const data = await apiGetWithRetry<MessagesResponse>(
          `/api/conversations/${activeConversationID}/messages`,
          controller.signal
        );
        const items = data.items.map(normalizeMessage);
        void markConversationRead(activeConversationID);
        if (showLoading) {
          dispatch({ type: "messages:success", items });
        } else {
          dispatch({ type: "messages:merge", items, activeConversationID });
        }
      } catch (err) {
        if (showLoading && err instanceof Error && err.name !== "AbortError") {
          dispatch({ type: "messages:error", message: err.message });
        }
      }
    };

    void loadMessages(true);
    const intervalID = window.setInterval(() => void loadMessages(false), 2500);
    return () => {
      window.clearInterval(intervalID);
      controller.abort();
    };
  }, [activeConversationID, normalizeMessage]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: loadingMessages ? "auto" : "smooth", block: "end" });
  }, [activeConversationID, loadingMessages, messages.length]);

  useEffect(() => {
    // Wait until the user identity is resolved — avoids a short-lived connection
    // that closes as soon as auth finishes and currentUserID becomes available.
    if (!activeConversationID || !currentUserID) return undefined;

    const socket = new WebSocket(buildWebSocketURL(activeConversationID));
    socketRef.current = socket;

    socket.onmessage = (event) => {
      const payload = JSON.parse(event.data as string) as ChatWebSocketEvent;
      if (payload.type === "error") {
        dispatch({ type: "error:set", message: payload.error ?? "Error en el chat en tiempo real" });
        return;
      }
      if (payload.type === "read" && payload.read) {
        dispatch({ type: "messages:read", messageIDs: payload.read.message_ids });
        return;
      }
      if (!payload.data) return;

      // Use the ref so we always call the latest version without re-creating the socket.
      const message = normalizeMessageRef.current(payload.data);
      dispatch({ type: "message:receive", message, activeConversationID });
      if (!message.is_mine && message.conversation_id === activeConversationID) {
        void markConversationRead(activeConversationID);
      }
    };

    socket.onerror = () => undefined;
    socket.onclose = () => {
      if (socketRef.current === socket) socketRef.current = null;
    };

    return () => {
      socket.close();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [activeConversationID, currentUserID]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeConversation || draft.trim() === "") return;

    dispatch({ type: "sending:start" });
    try {
      const socket = socketRef.current;
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "message", body: draft }));
        dispatch({ type: "draft:set", value: "" });
        return;
      }
      const message = await sendMessage(activeConversation.conversation_id, draft);
      dispatch({ type: "message:receive", message: normalizeMessage(message), activeConversationID });
      dispatch({ type: "draft:set", value: "" });
    } catch (err) {
      dispatch({ type: "error:set", message: err instanceof Error ? err.message : "Error al enviar el mensaje" });
    } finally {
      dispatch({ type: "sending:end" });
    }
  };

  const toggleSelectedConversation = (conversationID: string) => {
    setSelectedConversationIDs((current) => {
      const next = new Set(current);
      if (next.has(conversationID)) {
        next.delete(conversationID);
      } else {
        next.add(conversationID);
      }
      return next;
    });
  };

  const toggleSelectingConversations = () => {
    setSelectingConversations((current) => !current);
    setSelectedConversationIDs(new Set());
    setDeleteDialogOpen(false);
  };

  const handleConfirmDeleteConversation = async () => {
    const ids = Array.from(selectedConversationIDs);
    if (ids.length === 0) return;

    setDeletingConversation(true);
    dispatch({ type: "error:clear" });
    try {
      await Promise.all(ids.map((id) => deleteConversation(id)));
      for (const id of ids) dispatch({ type: "conversation:delete", conversationID: id });
      if (activeConversationID && ids.includes(activeConversationID)) void navigate("/chat");
      setSelectedConversationIDs(new Set());
      setSelectingConversations(false);
      setDeleteDialogOpen(false);
    } catch (err) {
      dispatch({
        type: "error:set",
        message: err instanceof Error ? err.message : "Error al eliminar las conversaciones",
      });
    } finally {
      setDeletingConversation(false);
    }
  };

  return {
    state,
    dispatch,
    messagesEndRef,
    selectingConversations,
    selectedConversationIDs,
    deleteDialogOpen,
    deletingConversation,
    filteredConversations,
    activeConversation,
    setDeleteDialogOpen,
    handleSubmit,
    toggleSelectedConversation,
    toggleSelectingConversations,
    handleConfirmDeleteConversation,
    navigate,
  };
}

/**
 * Messaging hub for user conversations.
 */
function Chat() {
  const { conversationId } = useParams();
  const {
    state,
    dispatch,
    messagesEndRef,
    selectingConversations,
    selectedConversationIDs,
    deleteDialogOpen,
    deletingConversation,
    filteredConversations,
    activeConversation,
    setDeleteDialogOpen,
    handleSubmit,
    toggleSelectedConversation,
    toggleSelectingConversations,
    handleConfirmDeleteConversation,
    navigate,
  } = useChatPage(conversationId);

  const {
    unreadCountsByConversationID,
    messages,
    draft,
    searchQuery,
    loadingConversations,
    loadingMessages,
    sending,
    error,
  } = state;

  return (
    <div className="bg-surface flex h-[calc(100vh-var(--spacing-navbar))] overflow-hidden">
      <ConversationList
        conversations={filteredConversations}
        loading={loadingConversations}
        searchQuery={searchQuery}
        activeConversationID={activeConversation?.conversation_id}
        unreadCountsByConversationID={unreadCountsByConversationID}
        selecting={selectingConversations}
        selectedConversationIDs={selectedConversationIDs}
        onSearchChange={(value) => dispatch({ type: "search:set", value })}
        onOpen={(id) => {
          dispatch({ type: "conversation:open", conversationID: id });
          void navigate(`/chat/${id}`);
        }}
        onToggleSelecting={toggleSelectingConversations}
        onToggleSelected={toggleSelectedConversation}
        onDeleteSelected={() => setDeleteDialogOpen(true)}
      />

      <section className="flex min-w-0 flex-1 flex-col">
        {activeConversation ? (
          <>
            <ChatHeader
              conversation={activeConversation}
              onViewProduct={() => navigate(`/product/${activeConversation.item_id}`)}
            />
            <MessagesPanel
              conversation={activeConversation}
              messages={messages}
              loadingMessages={loadingMessages}
              error={error}
              messagesEndRef={messagesEndRef}
            />
            <ChatComposer
              draft={draft}
              sending={sending}
              onDraftChange={(value) => dispatch({ type: "draft:set", value })}
              onSubmit={handleSubmit}
            />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center px-6">
            <p className="text-subtle text-center text-[14px]">Selecciona una conversación para ver los mensajes.</p>
          </div>
        )}
      </section>

      <DeleteConversationDialog
        count={deleteDialogOpen ? selectedConversationIDs.size : 0}
        deleting={deletingConversation}
        onCancel={() => {
          if (!deletingConversation) setDeleteDialogOpen(false);
        }}
        onConfirm={() => void handleConfirmDeleteConversation()}
      />
    </div>
  );
}

export { Chat };
