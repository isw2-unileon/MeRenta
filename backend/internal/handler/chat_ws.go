// Package handler provides HTTP handlers for the API.
package handler

import (
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/net/websocket"

	"github.com/isw2-unileon/MeRenta/backend/internal/model"
	"github.com/isw2-unileon/MeRenta/backend/internal/service"
	"github.com/isw2-unileon/MeRenta/backend/pkg/response"
)

// WebSocket handles GET /api/conversations/:id/ws.
func (h *ChatHandler) WebSocket(c *gin.Context) {
	customerID, ok := h.authenticateWebSocket(c)
	if !ok {
		return
	}

	conversationID, ok := parseUUIDParam(c)
	if !ok {
		return
	}

	if !h.ensureConversationAccess(c, customerID, conversationID) {
		return
	}

	server := websocket.Server{
		Handshake: func(*websocket.Config, *http.Request) error {
			return nil
		},
		Handler: func(ws *websocket.Conn) {
			h.handleWebSocketConnection(ws, customerID, conversationID)
		},
	}
	server.ServeHTTP(c.Writer, c.Request)
}

func (h *ChatHandler) authenticateWebSocket(c *gin.Context) (uuid.UUID, bool) {
	tokenStr := ""
	if cookie, err := c.Cookie(authCookieName); err == nil {
		tokenStr = strings.TrimSpace(cookie)
	}
	if tokenStr == "" {
		tokenStr = strings.TrimSpace(c.Query("access_token"))
	}
	if tokenStr == "" {
		tokenStr = strings.TrimSpace(c.Query("token"))
	}
	if tokenStr == "" {
		response.Error(c, http.StatusUnauthorized, "missing token")
		return uuid.UUID{}, false
	}

	claims, err := h.jwtMgr.Verify(tokenStr)
	if err != nil {
		response.Error(c, http.StatusUnauthorized, "invalid token")
		return uuid.UUID{}, false
	}

	return claims.CustomerID, true
}

func (h *ChatHandler) ensureConversationAccess(c *gin.Context, customerID, conversationID uuid.UUID) bool {
	if err := h.svc.EnsureParticipant(c.Request.Context(), customerID, conversationID); err != nil {
		if errors.Is(err, service.ErrConversationNotFound) {
			response.Error(c, http.StatusNotFound, err.Error())
			return false
		}
		slog.Error("websocket conversation auth failed", "error", err)
		response.Error(c, http.StatusInternalServerError, "internal server error")
		return false
	}

	return true
}

func (h *ChatHandler) handleWebSocketConnection(ws *websocket.Conn, customerID, conversationID uuid.UUID) {
	defer ws.Close()

	out := h.hub.Subscribe(conversationID)
	defer h.hub.Unsubscribe(conversationID, out)

	go h.forwardWebSocketEvents(ws, out)

	h.receiveWebSocketEvents(ws, customerID, conversationID, out)
}

func (h *ChatHandler) forwardWebSocketEvents(ws *websocket.Conn, out <-chan model.ChatWebSocketOut) {
	for event := range out {
		if err := websocket.JSON.Send(ws, event); err != nil {
			return
		}
	}
}

func (h *ChatHandler) receiveWebSocketEvents(
	ws *websocket.Conn,
	customerID uuid.UUID,
	conversationID uuid.UUID,
	out chan<- model.ChatWebSocketOut,
) {
	for {
		var incoming model.ChatWebSocketIn
		if err := websocket.JSON.Receive(ws, &incoming); err != nil {
			return
		}

		if incoming.Type != "message" {
			out <- model.ChatWebSocketOut{Type: "error", Error: "unsupported event type"}
			continue
		}

		message, err := h.svc.SendMessage(ws.Request().Context(), customerID, conversationID, incoming.Body)
		if err != nil {
			out <- model.ChatWebSocketOut{Type: "error", Error: err.Error()}
			continue
		}

		h.hub.Broadcast(conversationID, model.ChatWebSocketOut{Type: "message", Data: message})
	}
}
