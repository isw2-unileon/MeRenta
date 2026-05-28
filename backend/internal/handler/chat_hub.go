// Package handler provides HTTP handlers for the API.
package handler

import (
	"sync"

	"github.com/google/uuid"

	"github.com/isw2-unileon/MeRenta/backend/internal/model"
)

// ChatHub tracks websocket subscribers by conversation.
type ChatHub struct {
	mu      sync.RWMutex
	clients map[uuid.UUID]map[chan model.ChatWebSocketOut]struct{}
}

// NewChatHub builds an empty chat hub.
func NewChatHub() *ChatHub {
	return &ChatHub{
		clients: make(map[uuid.UUID]map[chan model.ChatWebSocketOut]struct{}),
	}
}

// Subscribe registers a websocket channel for a conversation.
func (h *ChatHub) Subscribe(conversationID uuid.UUID) chan model.ChatWebSocketOut {
	ch := make(chan model.ChatWebSocketOut, 16)

	h.mu.Lock()
	defer h.mu.Unlock()

	if h.clients[conversationID] == nil {
		h.clients[conversationID] = make(map[chan model.ChatWebSocketOut]struct{})
	}
	h.clients[conversationID][ch] = struct{}{}

	return ch
}

// Unsubscribe removes a websocket channel and closes it.
func (h *ChatHub) Unsubscribe(conversationID uuid.UUID, ch chan model.ChatWebSocketOut) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if clients, ok := h.clients[conversationID]; ok {
		delete(clients, ch)
		if len(clients) == 0 {
			delete(h.clients, conversationID)
		}
	}

	close(ch)
}

// Broadcast sends an event to all active subscribers for a conversation.
func (h *ChatHub) Broadcast(conversationID uuid.UUID, event model.ChatWebSocketOut) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	for ch := range h.clients[conversationID] {
		select {
		case ch <- event:
		default:
		}
	}
}
