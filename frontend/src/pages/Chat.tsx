import { useEffect, useMemo, useReducer, useRef, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowRight, CheckCheck, Search, SendHorizontal } from "lucide-react";

import type { ApiResponse } from "@/types/common";
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

interface ChatState {
  conversations: ConversationResponse[];
  unreadConversationIDs: Set<string>;
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
  unreadConversationIDs: new Set<string>(),
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
  const previousByID = new Map(state.conversations.map((conversation) => [conversation.conversation_id, conversation]));
  const unreadConversationIDs = new Set(state.unreadConversationIDs);

  for (const conversation of items) {
    const previous = previousByID.get(conversation.conversation_id);
    const changed =
      previous &&
      (previous.last_message_at !== conversation.last_message_at ||
        previous.last_message !== conversation.last_message);

    if (changed && conversation.conversation_id !== activeConversationID) {
      unreadConversationIDs.add(conversation.conversation_id);
    }
  }

  if (activeConversationID) {
    unreadConversationIDs.delete(activeConversationID);
  }

  return { ...state, conversations: sortConversations(items), unreadConversationIDs, loadingConversations: false };
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
        }
      : conversation
  );
  const unreadConversationIDs = new Set(state.unreadConversationIDs);

  if (message.conversation_id === activeConversationID || message.is_mine) {
    unreadConversationIDs.delete(message.conversation_id);
  } else {
    unreadConversationIDs.add(message.conversation_id);
  }

  return { ...state, messages, conversations: sortConversations(updatedConversations), unreadConversationIDs };
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
      return { ...state, conversations: sortConversations(action.items), loadingConversations: false };
    case "conversations:refresh":
      return refreshConversations(state, action.items, action.activeConversationID);
    case "conversations:error":
      return { ...state, error: action.message, loadingConversations: false };
    case "conversation:open": {
      const unreadConversationIDs = new Set(state.unreadConversationIDs);
      unreadConversationIDs.delete(action.conversationID);
      return { ...state, unreadConversationIDs };
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
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
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

async function apiGet<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { credentials: "include", signal });
  const json = (await res.json()) as ApiResponse<T>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message ?? json.error ?? "Error al cargar los datos");
  }
  return json.data;
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

function buildWebSocketURL(conversationID: string): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/api/conversations/${conversationID}/ws`;
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
  unread,
  onOpen,
}: {
  conversation: ConversationResponse;
  active: boolean;
  unread: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      className={`border-border-main relative grid h-auto w-full grid-cols-[44px_1fr_auto] items-center gap-3 rounded-none border-b px-4 py-5 text-left transition-colors ${
        active ? "bg-page" : unread ? "bg-[#d6f0e6] hover:bg-[#c7eadc]" : "hover:bg-section-alt"
      }`}
      onClick={onOpen}
    >
      {active || unread ? <span className="bg-primary absolute top-0 bottom-0 left-0 w-1" /> : null}
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
      <span className={`${unread ? "text-primary font-bold" : "text-footer-text"} self-start pt-1 text-[11px]`}>
        {formatConversationTime(conversation.last_message_at ?? conversation.updated_at)}
      </span>
    </button>
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
  unreadConversationIDs,
  onSearchChange,
  onOpen,
}: {
  conversations: ConversationResponse[];
  loading: boolean;
  searchQuery: string;
  activeConversationID?: string;
  unreadConversationIDs: Set<string>;
  onSearchChange: (value: string) => void;
  onOpen: (conversationID: string) => void;
}) {
  return (
    <aside className="border-border-main bg-page flex w-[320px] shrink-0 flex-col border-r">
      <div className="border-border-main border-b p-4">
        <h1 className="text-error-title font-bold">Mensajes</h1>
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
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }, (_, index) => (
              <div
                key={index}
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
              unread={unreadConversationIDs.has(conversation.conversation_id)}
              onOpen={() => onOpen(conversation.conversation_id)}
            />
          ))
        ) : (
          <p className="text-subtle p-5 text-[13px]">
            {searchQuery.trim() ? "No hay conversaciones que coincidan." : "Todavia no tienes conversaciones."}
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
    <header className="border-border-main bg-page flex h-18 shrink-0 items-center justify-between border-b px-6">
      <div className="flex items-center gap-3">
        <ChatAvatar
          name={conversation.other_user_name}
          image={conversation.other_avatar_url}
        />
        <div>
          <h2 className="text-[17px] font-bold">{conversation.other_user_name}</h2>
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
      className="border-border-main bg-page flex h-18 shrink-0 items-center gap-3 border-t px-4"
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

/**
 * Messaging hub for user conversations.
 */
function Chat() {
  const navigate = useNavigate();
  const { conversationId } = useParams();
  const [state, dispatch] = useReducer(chatReducer, initialState);
  const {
    conversations,
    unreadConversationIDs,
    messages,
    draft,
    searchQuery,
    loadingConversations,
    loadingMessages,
    sending,
    error,
  } = state;
  const socketRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    dispatch({ type: "error:clear" });

    apiGet<ConversationsResponse>("/api/conversations", controller.signal)
      .then((data) => dispatch({ type: "conversations:success", items: data.items }))
      .catch((err: Error) => {
        if (err.name !== "AbortError") dispatch({ type: "conversations:error", message: err.message });
      });

    return () => controller.abort();
  }, []);

  const activeConversation = useMemo(() => {
    if (conversations.length === 0) return undefined;
    return conversations.find((conversation) => conversation.conversation_id === conversationId) ?? conversations[0];
  }, [conversationId, conversations]);
  const activeConversationID = activeConversation?.conversation_id;

  const filteredConversations = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase("es-ES");
    if (!query) return conversations;

    return conversations.filter((conversation) => {
      const sellerName = conversation.other_user_name.toLocaleLowerCase("es-ES");
      const productTitle = conversation.item_title.toLocaleLowerCase("es-ES");
      return sellerName.includes(query) || productTitle.includes(query);
    });
  }, [conversations, searchQuery]);

  useEffect(() => {
    if (activeConversationID) {
      dispatch({ type: "conversation:open", conversationID: activeConversationID });
    }
  }, [activeConversationID]);

  useEffect(() => {
    const intervalID = window.setInterval(() => {
      void apiGet<ConversationsResponse>("/api/conversations")
        .then((data) =>
          dispatch({
            type: "conversations:refresh",
            items: data.items,
            activeConversationID,
          })
        )
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
    let active = true;

    const loadMessages = async (showLoading: boolean) => {
      if (showLoading) dispatch({ type: "messages:loading" });

      try {
        const data = await apiGet<MessagesResponse>(
          `/api/conversations/${activeConversationID}/messages`,
          controller.signal
        );
        if (!active) return;
        if (showLoading) {
          dispatch({ type: "messages:success", items: data.items });
        } else {
          dispatch({ type: "messages:merge", items: data.items, activeConversationID });
        }
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          dispatch({ type: "messages:error", message: err.message });
        }
      }
    };

    void loadMessages(true);
    const intervalID = window.setInterval(() => void loadMessages(false), 2500);

    return () => {
      active = false;
      window.clearInterval(intervalID);
      controller.abort();
    };
  }, [activeConversationID]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: loadingMessages ? "auto" : "smooth", block: "end" });
  }, [activeConversationID, loadingMessages, messages.length]);

  useEffect(() => {
    if (!activeConversationID) return undefined;

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

      dispatch({ type: "message:receive", message: payload.data, activeConversationID });
    };

    socket.onerror = () => {
      dispatch({ type: "error:set", message: "No se ha podido conectar el chat en tiempo real." });
    };

    socket.onclose = () => {
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
    };

    return () => {
      socket.close();
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
    };
  }, [activeConversationID]);

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
      dispatch({ type: "message:receive", message, activeConversationID });
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
        unreadConversationIDs={unreadConversationIDs}
        onSearchChange={(value) => dispatch({ type: "search:set", value })}
        onOpen={(id) => {
          dispatch({ type: "conversation:open", conversationID: id });
          void navigate(`/chat/${id}`);
        }}
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
    </div>
  );
}

export { Chat };
