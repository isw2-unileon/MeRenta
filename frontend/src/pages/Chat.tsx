import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowRight, CheckCheck, Search, SendHorizontal } from "lucide-react";

import type { ApiResponse } from "@/types/common";

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
}

interface MessagesResponse {
  items: MessageResponse[];
  total: number;
}

interface ChatWebSocketEvent {
  type: "message" | "error";
  data?: MessageResponse;
  error?: string;
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
  return new Intl.DateTimeFormat("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
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

  return new Intl.DateTimeFormat("es-ES", { weekday: "short" }).format(date);
}

function dayLabel(iso?: string): string {
  if (!iso) return "Hoy";
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
  }).format(new Date(iso));
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

  return <div className={`reviewer-avatar--blue flex shrink-0 items-center justify-center rounded-full font-bold ${size}`}>{initials}</div>;
}

function ConversationRow({ conversation, active, onOpen }: { conversation: ConversationResponse; active: boolean; onOpen: () => void }) {
  return (
    <button
      type="button"
      className={`relative grid h-auto w-full grid-cols-[44px_1fr_auto] items-center gap-3 rounded-none border-b border-border-main px-4 py-5 text-left transition-colors ${
        active ? "bg-page" : "hover:bg-section-alt"
      }`}
      onClick={onOpen}
    >
      {active ? <span className="bg-primary absolute top-0 bottom-0 left-0 w-1" /> : null}
      <ChatAvatar
        name={conversation.other_user_name}
        image={conversation.other_avatar_url}
      />
      <span className="min-w-0">
        <span className="text-ink block truncate text-[15px] font-bold">{conversation.other_user_name}</span>
        <span className="text-primary block truncate text-[11px] font-medium">{conversation.item_title}</span>
        <span className="text-subtle block truncate text-[12px]">{conversation.last_message || "Sin mensajes todavia"}</span>
      </span>
      <span className="text-footer-text self-start pt-1 text-[11px]">
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

      <div className={`max-w-[620px] ${isMine ? "items-end" : "items-start"} flex flex-col gap-1`}>
        <div
          className={`rounded-2xl px-5 py-4 text-[14px] leading-relaxed shadow-sm ${
            isMine ? "bg-primary text-white" : "border-border-main bg-page text-ink border"
          }`}
        >
          {message.body}
        </div>
        <div className={`flex items-center gap-1 text-[11px] ${isMine ? "text-subtle" : "text-footer-text"}`}>
          {isMine ? <CheckCheck size={14} /> : null}
          <span>{formatChatTime(message.created_at)}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Messaging hub for user conversations.
 */
function Chat() {
  const navigate = useNavigate();
  const { conversationId } = useParams();
  const [conversations, setConversations] = useState<ConversationResponse[]>([]);
  const [messages, setMessages] = useState<MessageResponse[]>([]);
  const [draft, setDraft] = useState("");
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoadingConversations(true);
    setError("");

    apiGet<ConversationsResponse>("/api/conversations", controller.signal)
      .then((data) => setConversations(data.items))
      .catch((err: Error) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => setLoadingConversations(false));

    return () => controller.abort();
  }, []);

  const activeConversation = useMemo(() => {
    if (conversations.length === 0) return undefined;
    return conversations.find((conversation) => conversation.conversation_id === conversationId) ?? conversations[0];
  }, [conversationId, conversations]);
  const activeConversationID = activeConversation?.conversation_id;

  useEffect(() => {
    if (!activeConversationID) {
      setMessages([]);
      return;
    }

    const controller = new AbortController();
    setLoadingMessages(true);
    setError("");

    apiGet<MessagesResponse>(`/api/conversations/${activeConversationID}/messages`, controller.signal)
      .then((data) => setMessages(data.items))
      .catch((err: Error) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => setLoadingMessages(false));

    return () => controller.abort();
  }, [activeConversationID]);

  useEffect(() => {
    if (!activeConversationID) return undefined;

    const socket = new WebSocket(buildWebSocketURL(activeConversationID));
    socketRef.current = socket;

    socket.onmessage = (event) => {
      const payload = JSON.parse(event.data as string) as ChatWebSocketEvent;
      if (payload.type === "error") {
        setError(payload.error ?? "Error en el chat en tiempo real");
        return;
      }
      if (payload.type !== "message" || !payload.data) return;

      const message = payload.data;
      setMessages((current) => {
        if (current.some((item) => item.message_id === message.message_id)) return current;
        return [...current, message];
      });
      setConversations((current) =>
        current.map((conversation) =>
          conversation.conversation_id === message.conversation_id
            ? {
                ...conversation,
                last_message: message.body,
                last_message_at: message.created_at,
                updated_at: message.created_at,
              }
            : conversation,
        ),
      );
    };

    socket.onerror = () => {
      setError("No se ha podido conectar el chat en tiempo real.");
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

    setSending(true);
    setError("");
    try {
      const socket = socketRef.current;
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "message", body: draft }));
        setDraft("");
        return;
      }

      const message = await sendMessage(activeConversation.conversation_id, draft);
      setMessages((current) => {
        if (current.some((item) => item.message_id === message.message_id)) return current;
        return [...current, message];
      });
      setDraft("");
      setConversations((current) =>
        current.map((conversation) =>
          conversation.conversation_id === activeConversation.conversation_id
            ? {
                ...conversation,
                last_message: message.body,
                last_message_at: message.created_at,
                updated_at: message.created_at,
              }
            : conversation,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al enviar el mensaje");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="bg-surface flex h-[calc(100vh-var(--spacing-navbar))] overflow-hidden">
      <aside className="border-border-main bg-page flex w-[320px] shrink-0 flex-col border-r">
        <div className="border-border-main border-b px-4 py-4">
          <h1 className="text-[19px] font-bold">Mensajes</h1>
          <label className="relative mt-5 mb-0 block">
            <Search
              size={16}
              className="text-placeholder pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
            />
            <input
              type="search"
              placeholder="Buscar conversacion..."
              className="h-10 rounded-lg pl-10 text-[12px]"
            />
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loadingConversations ? (
            <div className="space-y-4 p-4">
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
                active={conversation.conversation_id === activeConversation?.conversation_id}
                onOpen={() => navigate(`/chat/${conversation.conversation_id}`)}
              />
            ))
          ) : (
            <p className="text-subtle p-5 text-[13px]">Todavia no tienes conversaciones.</p>
          )}
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        {activeConversation ? (
          <>
            <header className="border-border-main bg-page flex h-[72px] shrink-0 items-center justify-between border-b px-6">
              <div className="flex items-center gap-3">
                <ChatAvatar
                  name={activeConversation.other_user_name}
                  image={activeConversation.other_avatar_url}
                />
                <div>
                  <h2 className="text-[17px] font-bold">{activeConversation.other_user_name}</h2>
                  <p className="bg-primary-light text-primary inline-flex max-w-[360px] truncate rounded-full px-2.5 py-0.5 text-[10px] font-medium">
                    {activeConversation.item_title} · {Math.round(activeConversation.item_price)} EUR/dia
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="text-primary h-auto gap-2 p-0 text-[13px] font-medium hover:text-primary-dark"
                onClick={() => navigate(`/product/${activeConversation.item_id}`)}
              >
                Ver producto
                <ArrowRight size={15} />
              </button>
            </header>

            {error ? <p className="border-border-main bg-error-danger text-report border-b px-6 py-3 text-[13px]">{error}</p> : null}

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
              <div className="mx-auto flex max-w-[980px] flex-col gap-5">
                <div className="flex justify-center">
                  <span className="bg-ghost text-subtle rounded-full px-5 py-2 text-[11px]">{dayLabel(messages[0]?.created_at)}</span>
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
                      otherUser={activeConversation}
                    />
                  ))
                ) : (
                  <p className="text-subtle text-center text-[13px]">Empieza la conversacion escribiendo el primer mensaje.</p>
                )}
              </div>
            </div>

            <form
              className="border-border-main bg-page flex h-[72px] shrink-0 items-center gap-3 border-t px-4"
              onSubmit={handleSubmit}
            >
              <input
                type="text"
                placeholder="Escribe un mensaje..."
                className="bg-surface h-11 rounded-full px-5"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
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
