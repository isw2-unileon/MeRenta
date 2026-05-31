// Package model contains request and response DTOs.
package model

import "time"

// CreateConversationRequest starts or returns a conversation for an item.
type CreateConversationRequest struct {
	ItemID string `json:"item_id" binding:"required,uuid"`
}

// SendMessageRequest defines the payload for creating a chat message.
type SendMessageRequest struct {
	Body string `json:"body" binding:"required,min=1,max=2000"`
}

// ConversationResponse is a compact conversation row for the chat list.
type ConversationResponse struct {
	ConversationID string     `json:"conversation_id"`
	ItemID         string     `json:"item_id"`
	ItemTitle      string     `json:"item_title"`
	ItemPrice      float64    `json:"item_price"`
	OtherUserID    string     `json:"other_user_id"`
	OtherUserName  string     `json:"other_user_name"`
	OtherAvatarURL string     `json:"other_avatar_url,omitempty"`
	LastMessage    string     `json:"last_message,omitempty"`
	LastMessageAt  *time.Time `json:"last_message_at,omitempty"`
	UpdatedAt      time.Time  `json:"updated_at"`
	UnreadCount    int        `json:"unread_count"`
}

// ConversationsResponse wraps the authenticated user's conversations.
type ConversationsResponse struct {
	Items []ConversationResponse `json:"items"`
	Total int                    `json:"total"`
}

// MessageResponse is an API representation of a chat message.
type MessageResponse struct {
	MessageID      string     `json:"message_id"`
	ConversationID string     `json:"conversation_id"`
	SenderID       string     `json:"sender_id"`
	Body           string     `json:"body"`
	ReadAt         *time.Time `json:"read_at,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	IsMine         bool       `json:"is_mine"`
	IsRead         bool       `json:"is_read"`
}

// MessagesResponse wraps all messages for a conversation.
type MessagesResponse struct {
	Items []MessageResponse `json:"items"`
	Total int               `json:"total"`
}

// ReadReceiptResponse notifies clients that messages in a conversation were read.
type ReadReceiptResponse struct {
	ConversationID string   `json:"conversation_id"`
	ReaderID       string   `json:"reader_id"`
	MessageIDs     []string `json:"message_ids"`
}

// ChatWebSocketIn is a message received from the browser over WebSocket.
type ChatWebSocketIn struct {
	Type string `json:"type"`
	Body string `json:"body,omitempty"`
}

// ChatWebSocketOut is an event sent to the browser over WebSocket.
type ChatWebSocketOut struct {
	Type  string               `json:"type"`
	Data  *MessageResponse     `json:"data,omitempty"`
	Read  *ReadReceiptResponse `json:"read,omitempty"`
	Error string               `json:"error,omitempty"`
}
