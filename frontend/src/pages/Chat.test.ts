import { describe, expect, it } from "vitest";

import { chatReducer, initialState, initialsFromName, mergeMessages } from "./Chat.logic";

type Conversation = (typeof initialState.conversations)[number];
type Message = (typeof initialState.messages)[number];

const baseConversation: Conversation = {
  conversation_id: "conv-1",
  item_id: "item-1",
  item_title: "Camara Sony",
  item_price: 25,
  other_user_id: "user-2",
  other_user_name: "Ana Lopez",
  other_user_verification_status: "verified",
  last_message: "Hola",
  last_message_at: "2026-06-05T09:00:00Z",
  updated_at: "2026-06-05T09:00:00Z",
  unread_count: 2,
};

const baseMessage: Message = {
  message_id: "msg-1",
  conversation_id: "conv-1",
  sender_id: "user-2",
  body: "Hola",
  created_at: "2026-06-05T09:00:00Z",
  is_mine: false,
  is_read: false,
};

describe("Chat reducer", () => {
  it("clears unread counters when opening a conversation", () => {
    const state = {
      ...initialState,
      conversations: [baseConversation],
      unreadCountsByConversationID: new Map([["conv-1", 2]]),
    };

    const next = chatReducer(state, { type: "conversation:open", conversationID: "conv-1" });

    expect(next.conversations[0]?.unread_count).toBe(0);
    expect(next.unreadCountsByConversationID.has("conv-1")).toBe(false);
  });

  it("adds incoming unread messages for inactive conversations only once", () => {
    const state = {
      ...initialState,
      conversations: [baseConversation],
      messages: [baseMessage],
      unreadCountsByConversationID: new Map([["conv-1", 2]]),
    };
    const incoming = {
      ...baseMessage,
      message_id: "msg-2",
      body: "Sigue disponible?",
      created_at: "2026-06-05T10:00:00Z",
    };

    const next = chatReducer(state, { type: "message:receive", message: incoming, activeConversationID: "conv-2" });
    const duplicate = chatReducer(next, { type: "message:receive", message: incoming, activeConversationID: "conv-2" });

    expect(next.messages).toHaveLength(2);
    expect(next.unreadCountsByConversationID.get("conv-1")).toBe(3);
    expect(duplicate.messages).toHaveLength(2);
  });

  it("merges read status updates and returns newly added messages", () => {
    const readMessage = { ...baseMessage, is_read: true, read_at: "2026-06-05T10:00:00Z" };
    const newMessage = { ...baseMessage, message_id: "msg-2", body: "Nuevo" };

    const result = mergeMessages([baseMessage], [readMessage, newMessage]);

    expect(result.messages[0]).toMatchObject({ message_id: "msg-1", is_read: true, read_at: readMessage.read_at });
    expect(result.added).toEqual([newMessage]);
  });

  it("builds initials from display names", () => {
    expect(initialsFromName("Ana Lopez")).toBe("AL");
    expect(initialsFromName("  merenta  ")).toBe("M");
    expect(initialsFromName("")).toBe("");
  });
});
