import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowRight, CheckCheck, Search, SendHorizontal, Trash2, X } from "lucide-react";

import type { ApiResponse } from "@/types/common";
import { useAuth } from "@/hooks/useAuth";
import * as React from "react";

interface ConversationResponse {
  conversation_id: string;
  item_id: string;
  item_title: string;
  item_price: number;
  other_user_id: string;
  other_user_name: string;
  other_avatar_url?: string;
  last_message?: string;
  last_message_at?: string;
  updated_at: string;
  unread_count: number;
}

interface ConversationsResponse {
  items: ConversationResponse[];
  total: number;
}

interface MessageResponse {
  message_id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  read_at?: string;
  created_at: string;
  is_mine: boolean;
  is_read: boolean;
}

interface MessagesResponse {
  items: MessageResponse[];
  total: number;
}

interface ChatWebSocketEvent {
  type: "message" | "read" | "error";
  data?: MessageResponse;
  read?: {
    conversation_id: string;
    reader_id: string;
    message_ids: string[];
  };
  error?: string;
}

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

interface ChatState {
  conversations: ConversationResponse[];
  unreadCountsByConversationID: Map<string, number>;
  messages: MessageResponse[];
  draft: string;
  searchQuery: string;
  loadingConversations: boolean;
  loadingMessages: boolean;
  sending: boolean;
  error: string;
}

type ChatAction =
  | { type: "conversations:success"; items: ConversationResponse[] }
  | { type: "conversations:refresh"; items: ConversationResponse[]; activeConversationID?: string }
  | { type: "conversations:error"; message: string }
  | { type: "conversation:open"; conversationID: string }
  | { type: "conversation:delete"; conversationID: string }
  | { type: "messages:loading" }
  | { type: "messages:success"; items: MessageResponse[] }
  | { type: "messages:merge"; items: MessageResponse[]; activeConversationID?: string }
  | { type: "messages:error"; message: string }
  | { type: "messages:reset" }
  | { type: "draft:set"; value: string }
  | { type: "search:set"; value: string }
  | { type: "sending:start" }
  | { type: "sending:end" }
  | { type: "message:receive"; message: MessageResponse; activeConversationID?: string }
  | { type: "messages:read"; messageIDs: string[] }
  | { type: "error:clear" }
  | { type: "error:set"; message: string };

const initialState: ChatState = {
  conversations: [],
  unreadCountsByConversationID: new Map<string, number>(),
  messages: [],
  draft: "",
  searchQuery: "",
  loadingConversations: true,
  loadingMessages: false,
  sending: false,
  error: "",
};

function sortConversations(conversations: ConversationResponse[]): ConversationResponse[] {
  return conversations.toSorted((a, b) => {
    const aTime = new Date(a.last_message_at ?? a.updated_at).getTime();
    const bTime = new Date(b.last_message_at ?? b.updated_at).getTime();
    return bTime - aTime;
  });
}

function refreshConversations(
  state: ChatState,
  items: ConversationResponse[],
  activeConversationID?: string
): ChatState {
  const unreadCountsByConversationID = new Map(state.unreadCountsByConversationID);

  for (const conversation of items) {
    if (conversation.conversation_id === activeConversationID) {
      unreadCountsByConversationID.delete(conversation.conversation_id);
    } else if (conversation.unread_count > 0) {
      unreadCountsByConversationID.set(conversation.conversation_id, conversation.unread_count);
    } else {
      unreadCountsByConversationID.delete(conversation.conversation_id);
    }
  }

  return {
    ...state,
    conversations: sortConversations(items),
    unreadCountsByConversationID,
    loadingConversations: false,
  };
}

function applyIncomingMessage(state: ChatState, message: MessageResponse, activeConversationID?: string): ChatState {
  const messages = state.messages.some((item) => item.message_id === message.message_id)
    ? state.messages
    : [...state.messages, message];

  const updatedConversations = state.conversations.map((conversation) =>
    conversation.conversation_id === message.conversation_id
      ? {
          ...conversation,
          last_message: message.body,
          last_message_at: message.created_at,
          updated_at: message.created_at,
          unread_count:
            message.conversation_id === activeConversationID || message.is_mine ? 0 : conversation.unread_count + 1,
        }
      : conversation
  );
  const unreadCountsByConversationID = new Map(state.unreadCountsByConversationID);

  if (message.conversation_id === activeConversationID || message.is_mine) {
    unreadCountsByConversationID.delete(message.conversation_id);
  } else {
    unreadCountsByConversationID.set(
      message.conversation_id,
      (unreadCountsByConversationID.get(message.conversation_id) ?? 0) + 1
    );
  }

  return { ...state, messages, conversations: sortConversations(updatedConversations), unreadCountsByConversationID };
}

function mergeMessages(
  current: MessageResponse[],
  incoming: MessageResponse[]
): {
  messages: MessageResponse[];
  added: MessageResponse[];
} {
  const incomingByID = new Map(incoming.map((message) => [message.message_id, message]));
  const known = new Set(current.map((message) => message.message_id));
  const next = current.map((message) => {
    const updated = incomingByID.get(message.message_id);
    if (!updated) return message;

    return {
      ...message,
      is_read: updated.is_read,
      read_at: updated.read_at,
    };
  });
  const added: MessageResponse[] = [];

  for (const message of incoming) {
    if (!known.has(message.message_id)) {
      next.push(message);
      added.push(message);
      known.add(message.message_id);
    }
  }

  return { messages: next, added };
}

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "conversations:success":
      return refreshConversations(state, action.items);
    case "conversations:refresh":
      return refreshConversations(state, action.items, action.activeConversationID);
    case "conversations:error":
      return { ...state, error: action.message, loadingConversations: false };
    case "conversation:open": {
      const unreadCountsByConversationID = new Map(state.unreadCountsByConversationID);
      unreadCountsByConversationID.delete(action.conversationID);
      return {
        ...state,
        conversations: state.conversations.map((conversation) =>
          conversation.conversation_id === action.conversationID ? { ...conversation, unread_count: 0 } : conversation
        ),
        unreadCountsByConversationID,
      };
    }
    case "conversation:delete": {
      const unreadCountsByConversationID = new Map(state.unreadCountsByConversationID);
      unreadCountsByConversationID.delete(action.conversationID);
      return {
        ...state,
        conversations: state.conversations.filter(
          (conversation) => conversation.conversation_id !== action.conversationID
        ),
        messages: state.messages.filter((message) => message.conversation_id !== action.conversationID),
        unreadCountsByConversationID,
      };
    }
    case "messages:loading":
      return { ...state, loadingMessages: true, error: "" };
    case "messages:success":
      return { ...state, messages: action.items, loadingMessages: false };
    case "messages:merge": {
      const merged = mergeMessages(state.messages, action.items);
      let nextState = { ...state, messages: merged.messages };
      for (const message of merged.added) {
        nextState = applyIncomingMessage(nextState, message, action.activeConversationID);
      }
      return nextState;
    }
    case "messages:error":
      return { ...state, error: action.message, loadingMessages: false };
    case "messages:reset":
      return { ...state, messages: [], loadingMessages: false };
    case "draft:set":
      return { ...state, draft: action.value };
    case "search:set":
      return { ...state, searchQuery: action.value };
    case "sending:start":
      return { ...state, sending: true, error: "" };
    case "sending:end":
      return { ...state, sending: false };
    case "message:receive":
      return applyIncomingMessage(state, action.message, action.activeConversationID);
    case "messages:read": {
      const readIDs = new Set(action.messageIDs);
      return {
        ...state,
        messages: state.messages.map((message) =>
          readIDs.has(message.message_id) ? { ...message, is_read: true } : message
        ),
      };
    }
    case "error:clear":
      return { ...state, error: "" };
    case "error:set":
      return { ...state, error: action.message };
    default:
      return state;
  }
}

function initialsFromName(name: string): string {
  let result = "";
  for (const part of name.split(" ")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    result += trimmed[0] ?? "";
    if (result.length >= 2) break;
  }
  return result.toUpperCase().slice(0, 2);
}

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

function buildWebSocketURL(conversationID: string, accessToken?: string | null): string {
  // In dev the Vite proxy (ws: true) forwards /api/* to the backend, so we connect
  // to the dev server origin and let the proxy handle the upgrade. This keeps the
  // connection same-origin and avoids a CSP violation for ws://localhost:8080.
  // In production we use VITE_API_BASE_URL directly (cross-origin backend).
  const apiBaseURL = import.meta.env.DEV
    ? window.location.origin
    : import.meta.env.VITE_API_BASE_URL.trim() || window.location.origin;
  const url = new URL(`/api/conversations/${conversationID}/ws`, apiBaseURL);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  if (accessToken) {
    url.searchParams.set("access_token", accessToken);
  }
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
          <span className="text-ink block truncate text-[15px] font-bold">{conversation.other_user_name}</span>
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
            placeholder="Buscar conversacion..."
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
          <h2 className="text-[17px] font-semibold">{conversation.other_user_name}</h2>
          <p className="bg-primary-light text-primary inline-flex max-w-90 truncate rounded-full px-2.5 py-0.5 text-[10px] font-medium">
            {conversation.item_title} · {Math.round(conversation.item_price)} EUR/dia
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
              Empieza la conversacion escribiendo el primer mensaje.
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
            <p className="text-subtle mt-2 text-[14px]">Desea eliminar {label} de tu bandeja?</p>
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

// ---------------------------------------------------------------------------
// Custom hooks — each owns one responsibility extracted from Chat.
// ---------------------------------------------------------------------------

/**
 * Manages the WebSocket connection for the active conversation.
 * Returns a ref to the live socket so the caller can send messages directly.
 */
function useChatWebSocket(
  activeConversationID: string | undefined,
  currentUserID: string | undefined,
  accessToken: string | null,
  normalizeMessage: (message: MessageResponse) => MessageResponse,
  dispatch: React.Dispatch<ChatAction>
): React.MutableRefObject<WebSocket | null> {
  const socketRef = useRef<WebSocket | null>(null);

  // Keep the latest normalizeMessage in a ref so the socket effect never needs
  // to list it as a dependency — the linter treats refs created with useRef()
  // in the same scope as stable and won't warn about them being missing.
  const normalizeMessageRef = useRef(normalizeMessage);
  useEffect(() => {
    normalizeMessageRef.current = normalizeMessage;
  }, [normalizeMessage]);

  useEffect(() => {
    // Wait until the user identity is resolved — avoids a short-lived connection
    // that closes as soon as auth finishes and currentUserID becomes available.
    if (!activeConversationID || !currentUserID) return undefined;

    const socket = new WebSocket(buildWebSocketURL(activeConversationID, accessToken));
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
  }, [accessToken, activeConversationID, currentUserID, dispatch]);

  return socketRef;
}

/**
 * Loads and polls messages for the active conversation, dispatching into
 * the shared chat reducer. Resets message state when no conversation is open.
 */
function useChatMessages(
  activeConversationID: string | undefined,
  normalizeMessage: (message: MessageResponse) => MessageResponse,
  dispatch: React.Dispatch<ChatAction>
): void {
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
  }, [activeConversationID, dispatch, normalizeMessage]);
}

/**
 * Manages conversation selection and bulk-delete UI state, keeping that
 * concern entirely separate from data fetching.
 */
function useConversationSelection(
  activeConversationID: string | undefined,
  dispatch: React.Dispatch<ChatAction>,
  navigate: ReturnType<typeof useNavigate>
) {
  const [selectingConversations, setSelectingConversations] = useState(false);
  const [selectedConversationIDs, setSelectedConversationIDs] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingConversation, setDeletingConversation] = useState(false);

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
      for (const id of ids) {
        dispatch({ type: "conversation:delete", conversationID: id });
      }
      if (activeConversationID && ids.includes(activeConversationID)) {
        void navigate("/chat");
      }
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
    selectingConversations,
    selectedConversationIDs,
    deleteDialogOpen,
    deletingConversation,
    setDeleteDialogOpen,
    toggleSelectedConversation,
    toggleSelectingConversations,
    handleConfirmDeleteConversation,
  };
}

// ---------------------------------------------------------------------------

/**
 * Messaging hub for user conversations.
 */
function Chat() {
  const navigate = useNavigate();
  const { conversationId } = useParams();
  const { user, accessToken } = useAuth();
  const [state, dispatch] = useReducer(chatReducer, initialState);
  const {
    conversations,
    unreadCountsByConversationID,
    messages,
    draft,
    searchQuery,
    loadingConversations,
    loadingMessages,
    sending,
    error,
  } = state;

  const currentUserID = user?.customer_id;
  const normalizeMessage = useCallback(
    (message: MessageResponse): MessageResponse =>
      currentUserID ? { ...message, is_mine: message.sender_id === currentUserID } : message,
    [currentUserID]
  );
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

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

  // Initial conversations load.
  useEffect(() => {
    const controller = new AbortController();
    dispatch({ type: "error:clear" });
    apiGetWithRetry<ConversationsResponse>("/api/conversations", controller.signal)
      .then((data) => dispatch({ type: "conversations:success", items: data.items }))
      .catch((err: Error) => {
        if (err.name !== "AbortError") dispatch({ type: "conversations:error", message: err.message });
      });
    return () => controller.abort();
  }, []);

  // Mark conversation read when the active conversation changes.
  useEffect(() => {
    if (activeConversationID) dispatch({ type: "conversation:open", conversationID: activeConversationID });
  }, [activeConversationID]);

  // Poll conversations list every 5 s to keep unread counts fresh.
  useEffect(() => {
    const intervalID = window.setInterval(() => {
      void apiGet<ConversationsResponse>("/api/conversations")
        .then((data) => dispatch({ type: "conversations:refresh", items: data.items, activeConversationID }))
        .catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(intervalID);
  }, [activeConversationID]);

  useChatMessages(activeConversationID, normalizeMessage, dispatch);

  // Scroll to the latest message whenever the list grows or the view loads.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: loadingMessages ? "auto" : "smooth", block: "end" });
  }, [activeConversationID, loadingMessages, messages.length]);

  const socketRef = useChatWebSocket(activeConversationID, currentUserID, accessToken, normalizeMessage, dispatch);

  const {
    selectingConversations,
    selectedConversationIDs,
    deleteDialogOpen,
    deletingConversation,
    setDeleteDialogOpen,
    toggleSelectedConversation,
    toggleSelectingConversations,
    handleConfirmDeleteConversation,
  } = useConversationSelection(activeConversationID, dispatch, navigate);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
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
      dispatch({
        type: "error:set",
        message: err instanceof Error ? err.message : "Error al enviar el mensaje",
      });
    } finally {
      dispatch({ type: "sending:end" });
    }
  }

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
            <p className="text-subtle text-center text-[14px]">Selecciona una conversacion para ver los mensajes.</p>
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
