interface ConversationResponse {
  conversation_id: string;
  item_id: string;
  item_title: string;
  item_price: number;
  other_user_id: string;
  other_user_name: string;
  other_avatar_url?: string;
  other_user_verification_status: string;
  last_message?: string;
  last_message_at?: string;
  updated_at: string;
  unread_count: number;
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

interface ConversationsResponse {
  items: ConversationResponse[];
  total: number;
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

export {
  initialState,
  sortConversations,
  refreshConversations,
  applyIncomingMessage,
  mergeMessages,
  chatReducer,
  initialsFromName,
};
export type {
  ChatAction,
  ChatState,
  ChatWebSocketEvent,
  ConversationResponse,
  ConversationsResponse,
  MessageResponse,
  MessagesResponse,
};
