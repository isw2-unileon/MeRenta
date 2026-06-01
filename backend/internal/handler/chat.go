// Package handler provides HTTP handlers for the API.
package handler

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/isw2-unileon/MeRenta/backend/internal/model"
	"github.com/isw2-unileon/MeRenta/backend/internal/service"
	"github.com/isw2-unileon/MeRenta/backend/pkg/jwt"
	"github.com/isw2-unileon/MeRenta/backend/pkg/response"
)

// ChatHandler wires chat endpoints to the chat service.
type ChatHandler struct {
	svc    *service.ChatService
	hub    *ChatHub
	jwtMgr *jwt.Manager
}

// NewChatHandler builds a new ChatHandler.
func NewChatHandler(svc *service.ChatService, hub *ChatHub, jwtMgr *jwt.Manager) *ChatHandler {
	return &ChatHandler{svc: svc, hub: hub, jwtMgr: jwtMgr}
}

// ListConversations handles GET /api/conversations.
func (h *ChatHandler) ListConversations(c *gin.Context) {
	customerID, ok := getCustomerID(c)
	if !ok {
		return
	}

	res, err := h.svc.ListConversations(c.Request.Context(), customerID)
	if err != nil {
		slog.Error("list conversations failed", "error", err)
		response.Error(c, http.StatusInternalServerError, "internal server error")
		return
	}

	response.OK(c, http.StatusOK, res)
}

// StartConversation handles POST /api/conversations.
// When with_user_id is provided the caller must be the item owner; this allows
// owners to message a specific renter directly from their booking dashboard.
func (h *ChatHandler) StartConversation(c *gin.Context) {
	customerID, ok := getCustomerID(c)
	if !ok {
		return
	}

	var req model.CreateConversationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "invalid request")
		return
	}

	itemID, ok := parseUUIDString(c, req.ItemID)
	if !ok {
		return
	}

	var (
		res *model.ConversationResponse
		err error
	)

	if req.WithUserID != "" {
		renterID, ok := parseUUIDString(c, req.WithUserID)
		if !ok {
			return
		}
		res, err = h.svc.StartConversationWith(c.Request.Context(), customerID, renterID, itemID)
	} else {
		res, err = h.svc.StartConversation(c.Request.Context(), customerID, itemID)
	}

	if err != nil {
		h.handleConversationErr(c, err)
		return
	}

	response.OK(c, http.StatusCreated, res)
}

func (h *ChatHandler) handleConversationErr(c *gin.Context, err error) {
	switch {
	case errors.Is(err, service.ErrItemNotFound):
		response.Error(c, http.StatusNotFound, err.Error())
	case errors.Is(err, service.ErrCannotMessageSelf),
		errors.Is(err, service.ErrConversationForbidden):
		response.Error(c, http.StatusBadRequest, err.Error())
	default:
		slog.Error("start conversation failed", "error", err)
		response.Error(c, http.StatusInternalServerError, "internal server error")
	}
}

// DeleteConversation handles DELETE /api/conversations/:id.
func (h *ChatHandler) DeleteConversation(c *gin.Context) {
	customerID, ok := getCustomerID(c)
	if !ok {
		return
	}

	conversationID, ok := parseUUIDParam(c)
	if !ok {
		return
	}

	if err := h.svc.DeleteConversation(c.Request.Context(), customerID, conversationID); err != nil {
		if errors.Is(err, service.ErrConversationNotFound) {
			response.Error(c, http.StatusNotFound, err.Error())
			return
		}
		slog.Error("delete conversation failed", "error", err)
		response.Error(c, http.StatusInternalServerError, "internal server error")
		return
	}

	response.OK(c, http.StatusOK, gin.H{"deleted": true})
}

// MarkMessagesRead handles POST /api/conversations/:id/read.
func (h *ChatHandler) MarkMessagesRead(c *gin.Context) {
	customerID, ok := getCustomerID(c)
	if !ok {
		return
	}

	conversationID, ok := parseUUIDParam(c)
	if !ok {
		return
	}

	readReceipt, err := h.svc.MarkMessagesRead(c.Request.Context(), customerID, conversationID)
	if err != nil {
		if errors.Is(err, service.ErrConversationNotFound) {
			response.Error(c, http.StatusNotFound, err.Error())
			return
		}
		slog.Error("mark messages read failed", "error", err)
		response.Error(c, http.StatusInternalServerError, "internal server error")
		return
	}
	if len(readReceipt.MessageIDs) > 0 {
		h.hub.Broadcast(conversationID, model.ChatWebSocketOut{Type: "read", Read: readReceipt})
	}

	response.OK(c, http.StatusOK, readReceipt)
}

// ListMessages handles GET /api/conversations/:id/messages.
func (h *ChatHandler) ListMessages(c *gin.Context) {
	customerID, ok := getCustomerID(c)
	if !ok {
		return
	}

	conversationID, ok := parseUUIDParam(c)
	if !ok {
		return
	}

	res, err := h.svc.GetMessages(c.Request.Context(), customerID, conversationID)
	if err != nil {
		if errors.Is(err, service.ErrConversationNotFound) {
			response.Error(c, http.StatusNotFound, err.Error())
			return
		}
		slog.Error("list messages failed", "error", err)
		response.Error(c, http.StatusInternalServerError, "internal server error")
		return
	}

	response.OK(c, http.StatusOK, res)
}

// SendMessage handles POST /api/conversations/:id/messages.
func (h *ChatHandler) SendMessage(c *gin.Context) {
	customerID, ok := getCustomerID(c)
	if !ok {
		return
	}

	conversationID, ok := parseUUIDParam(c)
	if !ok {
		return
	}

	var req model.SendMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "invalid request")
		return
	}

	res, err := h.svc.SendMessage(c.Request.Context(), customerID, conversationID, req.Body)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrConversationNotFound):
			response.Error(c, http.StatusNotFound, err.Error())
		case errors.Is(err, service.ErrEmptyMessage):
			response.Error(c, http.StatusBadRequest, err.Error())
		default:
			slog.Error("send message failed", "error", err)
			response.Error(c, http.StatusInternalServerError, "internal server error")
		}
		return
	}

	h.hub.Broadcast(conversationID, model.ChatWebSocketOut{Type: "message", Data: res})
	response.OK(c, http.StatusCreated, res)
}
