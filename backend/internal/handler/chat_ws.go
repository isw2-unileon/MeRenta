// Package handler provides HTTP handlers for the API.
package handler

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
	"golang.org/x/net/websocket"

	"github.com/isw2-unileon/MeRenta/backend/internal/model"
	"github.com/isw2-unileon/MeRenta/backend/internal/service"
	"github.com/isw2-unileon/MeRenta/backend/pkg/response"
)

// WebSocket handles GET /api/conversations/:id/ws.
func (h *ChatHandler) WebSocket(c *gin.Context) {
	customerID, ok := getCustomerID(c)
	if !ok {
		return
	}

	conversationID, ok := parseUUIDParam(c)
	if !ok {
		return
	}

	if err := h.svc.EnsureParticipant(c.Request.Context(), customerID, conversationID); err != nil {
		if errors.Is(err, service.ErrConversationNotFound) {
			response.Error(c, http.StatusNotFound, err.Error())
			return
		}
		slog.Error("websocket conversation auth failed", "error", err)
		response.Error(c, http.StatusInternalServerError, "internal server error")
		return
	}

	server := websocket.Server{
		Handshake: func(*websocket.Config, *http.Request) error {
			return nil
		},
		Handler: func(ws *websocket.Conn) {
			defer ws.Close()

			out := h.hub.Subscribe(conversationID)
			defer h.hub.Unsubscribe(conversationID, out)

			go func() {
				for event := range out {
					if err := websocket.JSON.Send(ws, event); err != nil {
						return
					}
				}
			}()

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
		},
	}
	server.ServeHTTP(c.Writer, c.Request)
}
