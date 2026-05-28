// Package service contains business logic for the API.
package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/isw2-unileon/MeRenta/backend/internal/model"
	"github.com/isw2-unileon/MeRenta/backend/internal/sqlcdb"
)

var (
	// ErrConversationNotFound indicates the conversation does not exist or is not visible to the caller.
	ErrConversationNotFound = errors.New("conversation not found")
	// ErrCannotMessageSelf prevents owners from opening a chat with themselves.
	ErrCannotMessageSelf = errors.New("cannot message yourself")
	// ErrEmptyMessage indicates the message body is blank after trimming.
	ErrEmptyMessage = errors.New("message body is required")
)

// chatQuerier is the minimal DB interface required by ChatService.
type chatQuerier interface {
	GetItemChatInfo(ctx context.Context, itemID uuid.UUID) (sqlcdb.ItemChatInfoRow, error)
	CreateConversation(ctx context.Context, arg sqlcdb.CreateConversationParams) (uuid.UUID, error)
	ListConversations(ctx context.Context, customerID uuid.UUID) ([]sqlcdb.ConversationRow, error)
	GetConversation(ctx context.Context, conversationID, customerID uuid.UUID) (sqlcdb.ConversationRow, error)
	SendMessage(ctx context.Context, arg sqlcdb.SendMessageParams) (sqlcdb.MessageRow, error)
	ListMessages(ctx context.Context, conversationID uuid.UUID) ([]sqlcdb.MessageRow, error)
	TouchConversation(ctx context.Context, conversationID uuid.UUID) error
	MarkMessagesRead(ctx context.Context, conversationID, readerID uuid.UUID) ([]uuid.UUID, error)
}

// ChatService handles conversation and message use cases.
type ChatService struct {
	q      chatQuerier
	cipher *messageCipher
}

// NewChatService creates a ChatService with its dependencies.
func NewChatService(q chatQuerier, messageEncryptionKey []byte) (*ChatService, error) {
	cipher, err := newMessageCipher(messageEncryptionKey)
	if err != nil {
		return nil, fmt.Errorf("creating message cipher: %w", err)
	}
	return &ChatService{q: q, cipher: cipher}, nil
}

// StartConversation creates or returns the conversation between the current user and an item owner.
func (s *ChatService) StartConversation(ctx context.Context, customerID, itemID uuid.UUID) (*model.ConversationResponse, error) {
	item, err := s.q.GetItemChatInfo(ctx, itemID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrItemNotFound
		}
		return nil, err
	}

	if item.OwnerID == customerID {
		return nil, ErrCannotMessageSelf
	}

	conversationID, err := s.q.CreateConversation(ctx, sqlcdb.CreateConversationParams{
		ItemID:   item.ItemID,
		OwnerID:  item.OwnerID,
		RenterID: customerID,
	})
	if err != nil {
		return nil, err
	}

	conversation, err := s.q.GetConversation(ctx, conversationID, customerID)
	if err != nil {
		return nil, err
	}

	res, err := s.toConversationResponse(conversation)
	if err != nil {
		return nil, err
	}
	return &res, nil
}

// ListConversations returns all conversations for a customer.
func (s *ChatService) ListConversations(ctx context.Context, customerID uuid.UUID) (*model.ConversationsResponse, error) {
	rows, err := s.q.ListConversations(ctx, customerID)
	if err != nil {
		return nil, err
	}

	items := make([]model.ConversationResponse, 0, len(rows))
	for _, row := range rows {
		item, err := s.toConversationResponse(row)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}

	return &model.ConversationsResponse{Items: items, Total: len(items)}, nil
}

// GetMessages returns all messages in a conversation visible to the caller.
func (s *ChatService) GetMessages(ctx context.Context, customerID, conversationID uuid.UUID) (*model.MessagesResponse, error) {
	if err := s.EnsureParticipant(ctx, customerID, conversationID); err != nil {
		return nil, err
	}

	rows, err := s.q.ListMessages(ctx, conversationID)
	if err != nil {
		return nil, err
	}

	items := make([]model.MessageResponse, 0, len(rows))
	for _, row := range rows {
		item, err := s.toMessageResponse(row, customerID)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}

	return &model.MessagesResponse{Items: items, Total: len(items)}, nil
}

// MarkMessagesRead marks unread messages from the other participant as read.
func (s *ChatService) MarkMessagesRead(ctx context.Context, customerID, conversationID uuid.UUID) (*model.ReadReceiptResponse, error) {
	if err := s.EnsureParticipant(ctx, customerID, conversationID); err != nil {
		return nil, err
	}

	messageIDs, err := s.q.MarkMessagesRead(ctx, conversationID, customerID)
	if err != nil {
		return nil, err
	}

	ids := make([]string, 0, len(messageIDs))
	for _, messageID := range messageIDs {
		ids = append(ids, messageID.String())
	}

	return &model.ReadReceiptResponse{
		ConversationID: conversationID.String(),
		ReaderID:       customerID.String(),
		MessageIDs:     ids,
	}, nil
}

// EnsureParticipant verifies that the customer belongs to the conversation.
func (s *ChatService) EnsureParticipant(ctx context.Context, customerID, conversationID uuid.UUID) error {
	if _, err := s.q.GetConversation(ctx, conversationID, customerID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrConversationNotFound
		}
		return err
	}

	return nil
}

// SendMessage appends a message to a conversation visible to the caller.
func (s *ChatService) SendMessage(ctx context.Context, customerID, conversationID uuid.UUID, body string) (*model.MessageResponse, error) {
	trimmed := strings.TrimSpace(body)
	if trimmed == "" {
		return nil, ErrEmptyMessage
	}

	if _, err := s.q.GetConversation(ctx, conversationID, customerID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrConversationNotFound
		}
		return nil, err
	}

	encryptedBody, err := s.cipher.Encrypt(trimmed)
	if err != nil {
		return nil, fmt.Errorf("encrypting message: %w", err)
	}

	row, err := s.q.SendMessage(ctx, sqlcdb.SendMessageParams{
		ConversationID: conversationID,
		SenderID:       customerID,
		Body:           encryptedBody,
	})
	if err != nil {
		return nil, err
	}

	if err := s.q.TouchConversation(ctx, conversationID); err != nil {
		return nil, err
	}

	res, err := s.toMessageResponse(row, customerID)
	if err != nil {
		return nil, err
	}
	return &res, nil
}

func (s *ChatService) toConversationResponse(row sqlcdb.ConversationRow) (model.ConversationResponse, error) {
	itemPrice, err := numericToFloat64(row.ItemPrice)
	if err != nil {
		return model.ConversationResponse{}, fmt.Errorf("converting item_price: %w", err)
	}
	lastMessage, err := s.cipher.Decrypt(row.LastMessage)
	if err != nil {
		return model.ConversationResponse{}, fmt.Errorf("decrypting last message: %w", err)
	}

	return model.ConversationResponse{
		ConversationID: row.ConversationID.String(),
		ItemID:         row.ItemID.String(),
		ItemTitle:      row.ItemTitle,
		ItemPrice:      itemPrice,
		OtherUserID:    row.OtherUserID.String(),
		OtherUserName:  row.OtherUserName,
		OtherAvatarURL: row.OtherAvatarURL,
		LastMessage:    lastMessage,
		LastMessageAt:  timestamptzPtr(row.LastMessageAt),
		UpdatedAt:      row.UpdatedAt.Time,
	}, nil
}

func (s *ChatService) toMessageResponse(row sqlcdb.MessageRow, customerID uuid.UUID) (model.MessageResponse, error) {
	body, err := s.cipher.Decrypt(row.Body)
	if err != nil {
		return model.MessageResponse{}, fmt.Errorf("decrypting message: %w", err)
	}
	return model.MessageResponse{
		MessageID:      row.MessageID.String(),
		ConversationID: row.ConversationID.String(),
		SenderID:       row.SenderID.String(),
		Body:           body,
		ReadAt:         timestamptzPtr(row.ReadAt),
		CreatedAt:      row.CreatedAt.Time,
		IsMine:         row.SenderID == customerID,
		IsRead:         row.IsRead,
	}, nil
}

func timestamptzPtr(value pgtype.Timestamptz) *time.Time {
	if !value.Valid {
		return nil
	}
	return &value.Time
}
