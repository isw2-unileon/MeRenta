// Package handler provides HTTP handlers for the API.
package handler

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"

	"github.com/isw2-unileon/MeRenta/backend/internal/model"
	"github.com/isw2-unileon/MeRenta/backend/internal/service"
	"github.com/isw2-unileon/MeRenta/backend/pkg/response"
)

// chatWebSocketUpgrader upgrades HTTP requests to WebSocket connections.
// Origin checks are intentionally permissive because access is gated by JWT
// authentication and conversation-participant checks before upgrading.
var chatWebSocketUpgrader = websocket.Upgrader{
	CheckOrigin: func(*http.Request) bool {
		return true
	},
}

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

	ws, err := chatWebSocketUpgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		slog.Error("websocket upgrade failed", "error", err)
		return
	}

	h.handleWebSocketConnection(c.Request.Context(), ws, customerID, conversationID)
}

// authenticateWebSocket extracts and verifies the JWT from the cookie or query
// params (browsers cannot set headers on a WebSocket handshake), returning the
// authenticated customer ID or writing a 401 and returning false.
func (h *ChatHandler) authenticateWebSocket(c *gin.Context) (uuid.UUID, bool) {
	tokenStr := ""
	tokenSource := ""
	if cookie, err := c.Cookie(authCookieName); err == nil {
		tokenStr = strings.TrimSpace(cookie)
		if tokenStr != "" {
			tokenSource = "cookie"
		}
	}
	if tokenStr == "" {
		tokenStr = strings.TrimSpace(c.Query("access_token"))
		if tokenStr != "" {
			tokenSource = "access_token_query"
		}
	}
	if tokenStr == "" {
		tokenStr = strings.TrimSpace(c.Query("token"))
		if tokenStr != "" {
			tokenSource = "token_query"
		}
	}
	if tokenStr == "" {
		slog.Info(
			"websocket auth missing token",
			"origin", c.GetHeader("Origin"),
			"host", c.Request.Host,
			"path", c.Request.URL.Path,
			"has_access_token_query", c.Query("access_token") != "",
			"has_token_query", c.Query("token") != "",
		)
		response.Error(c, http.StatusUnauthorized, "missing token")
		return uuid.UUID{}, false
	}

	claims, err := h.jwtMgr.Verify(tokenStr)
	if err != nil {
		slog.Info(
			"websocket auth invalid token",
			"source", tokenSource,
			"origin", c.GetHeader("Origin"),
			"host", c.Request.Host,
			"error", err,
		)
		response.Error(c, http.StatusUnauthorized, "invalid token")
		return uuid.UUID{}, false
	}

	slog.Info("websocket auth ok", "source", tokenSource, "customer_id", claims.CustomerID)
	return claims.CustomerID, true
}

// ensureConversationAccess verifies the customer participates in the
// conversation, writing 404/500 and returning false when they do not.
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

// handleWebSocketConnection subscribes the connection to the conversation hub,
// fans out broadcast events in a goroutine, and processes inbound messages
// until the socket closes, cleaning up the subscription on return.
func (h *ChatHandler) handleWebSocketConnection(
	ctx context.Context,
	ws *websocket.Conn,
	customerID uuid.UUID,
	conversationID uuid.UUID,
) {
	defer func(ws *websocket.Conn) {
		err := ws.Close()
		if err != nil {
			slog.Warn("failed to close websocket connection", "error", err)
		}
	}(ws)

	out := h.hub.Subscribe(conversationID)
	defer h.hub.Unsubscribe(conversationID, out)

	go h.forwardWebSocketEvents(ws, out)

	h.receiveWebSocketEvents(ctx, ws, customerID, conversationID, out)
}

// forwardWebSocketEvents writes hub events to the socket until the channel is
// closed or a write fails.
func (h *ChatHandler) forwardWebSocketEvents(ws *websocket.Conn, out <-chan model.ChatWebSocketOut) {
	for event := range out {
		if err := ws.WriteJSON(event); err != nil {
			return
		}
	}
}

// receiveWebSocketEvents reads inbound "message" events from the socket,
// persists each via the chat service and broadcasts it to the conversation,
// returning errors to the sender over the out channel.
func (h *ChatHandler) receiveWebSocketEvents(
	ctx context.Context,
	ws *websocket.Conn,
	customerID uuid.UUID,
	conversationID uuid.UUID,
	out chan<- model.ChatWebSocketOut,
) {
	for {
		var incoming model.ChatWebSocketIn
		if err := ws.ReadJSON(&incoming); err != nil {
			return
		}

		if incoming.Type != "message" {
			out <- model.ChatWebSocketOut{Type: "error", Error: "unsupported event type"}
			continue
		}

		message, err := h.svc.SendMessage(ctx, customerID, conversationID, incoming.Body)
		if err != nil {
			out <- model.ChatWebSocketOut{Type: "error", Error: err.Error()}
			continue
		}

		h.hub.Broadcast(conversationID, model.ChatWebSocketOut{Type: "message", Data: message})
	}
}
