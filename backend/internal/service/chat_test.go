package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/isw2-unileon/MeRenta/backend/internal/sqlcdb"
)

type chatQuerierStub struct {
	itemInfo        sqlcdb.ItemChatInfoRow
	itemInfoErr     error
	conversationID  uuid.UUID
	conversation    sqlcdb.ConversationRow
	conversationErr error
	listRows        []sqlcdb.ConversationRow
	messageRows     []sqlcdb.MessageRow
	sentArg         sqlcdb.SendMessageParams
	markReadIDs     []uuid.UUID
	deleteErr       error

	restoredForCustomer bool
	touched             bool
	restored            bool
}

func (s *chatQuerierStub) GetItemChatInfo(context.Context, uuid.UUID) (sqlcdb.ItemChatInfoRow, error) {
	return s.itemInfo, s.itemInfoErr
}

func (s *chatQuerierStub) CreateConversation(
	context.Context,
	sqlcdb.CreateConversationParams,
) (uuid.UUID, error) {
	return s.conversationID, nil
}

func (s *chatQuerierStub) ListConversations(context.Context, uuid.UUID) ([]sqlcdb.ConversationRow, error) {
	return s.listRows, nil
}

func (s *chatQuerierStub) GetConversation(context.Context, uuid.UUID, uuid.UUID) (sqlcdb.ConversationRow, error) {
	return s.conversation, s.conversationErr
}

func (s *chatQuerierStub) SendMessage(_ context.Context, arg sqlcdb.SendMessageParams) (sqlcdb.MessageRow, error) {
	s.sentArg = arg
	return sqlcdb.MessageRow{
		MessageID:      uuid.MustParse("55555555-5555-5555-5555-555555555555"),
		ConversationID: arg.ConversationID,
		SenderID:       arg.SenderID,
		Body:           arg.Body,
		CreatedAt:      pgtype.Timestamptz{Time: time.Date(2026, 6, 1, 12, 0, 0, 0, time.UTC), Valid: true},
	}, nil
}

func (s *chatQuerierStub) ListMessages(context.Context, uuid.UUID) ([]sqlcdb.MessageRow, error) {
	return s.messageRows, nil
}

func (s *chatQuerierStub) TouchConversation(context.Context, uuid.UUID) error {
	s.touched = true
	return nil
}

func (s *chatQuerierStub) MarkMessagesRead(context.Context, uuid.UUID, uuid.UUID) ([]uuid.UUID, error) {
	return s.markReadIDs, nil
}

func (s *chatQuerierStub) DeleteConversation(context.Context, sqlcdb.DeleteConversationParams) (uuid.UUID, error) {
	return s.conversationID, s.deleteErr
}

func (s *chatQuerierStub) RestoreConversationForCustomer(context.Context, uuid.UUID, uuid.UUID) error {
	s.restoredForCustomer = true
	return nil
}

func (s *chatQuerierStub) RestoreConversation(context.Context, uuid.UUID) error {
	s.restored = true
	return nil
}

func TestChatServiceStartConversationValidation(t *testing.T) {
	t.Parallel()

	customerID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	itemID := uuid.MustParse("22222222-2222-2222-2222-222222222222")

	tests := []struct {
		name string
		stub *chatQuerierStub
		want error
	}{
		{
			name: "item not found",
			stub: &chatQuerierStub{itemInfoErr: pgx.ErrNoRows},
			want: ErrItemNotFound,
		},
		{
			name: "cannot message self",
			stub: &chatQuerierStub{itemInfo: sqlcdb.ItemChatInfoRow{ItemID: itemID, OwnerID: customerID}},
			want: ErrCannotMessageSelf,
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			svc := newTestChatService(t, tt.stub)
			if _, err := svc.StartConversation(context.Background(), customerID, itemID); !errors.Is(err, tt.want) {
				t.Fatalf("StartConversation error = %v, want %v", err, tt.want)
			}
		})
	}
}

func TestChatServiceStartConversationRestoresAndMapsResponse(t *testing.T) {
	t.Parallel()

	customerID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	ownerID := uuid.MustParse("33333333-3333-3333-3333-333333333333")
	itemID := uuid.MustParse("22222222-2222-2222-2222-222222222222")
	conversationID := uuid.MustParse("44444444-4444-4444-4444-444444444444")
	stub := &chatQuerierStub{
		itemInfo:       sqlcdb.ItemChatInfoRow{ItemID: itemID, OwnerID: ownerID},
		conversationID: conversationID,
	}
	svc := newTestChatService(t, stub)
	stub.conversation = testConversationRow(t, svc, conversationID, itemID, ownerID, "Hola")

	res, err := svc.StartConversation(context.Background(), customerID, itemID)
	if err != nil {
		t.Fatalf("StartConversation returned error: %v", err)
	}

	if !stub.restoredForCustomer {
		t.Fatal("expected conversation to be restored for caller")
	}
	if res.ConversationID != conversationID.String() || res.LastMessage != "Hola" || res.ItemPrice != 12.5 {
		t.Fatalf("response = %+v", res)
	}
}

func TestChatServiceSendMessageTrimsEncryptsAndRestores(t *testing.T) {
	t.Parallel()

	customerID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	itemID := uuid.MustParse("22222222-2222-2222-2222-222222222222")
	conversationID := uuid.MustParse("44444444-4444-4444-4444-444444444444")
	stub := &chatQuerierStub{}
	svc := newTestChatService(t, stub)
	stub.conversation = testConversationRow(t, svc, conversationID, itemID, customerID, "")

	if _, err := svc.SendMessage(context.Background(), customerID, conversationID, "  \t  "); !errors.Is(err, ErrEmptyMessage) {
		t.Fatalf("blank SendMessage error = %v, want %v", err, ErrEmptyMessage)
	}

	res, err := svc.SendMessage(context.Background(), customerID, conversationID, "  hola mundo  ")
	if err != nil {
		t.Fatalf("SendMessage returned error: %v", err)
	}

	if stub.sentArg.Body == "hola mundo" || stub.sentArg.Body == "" {
		t.Fatalf("message body was not encrypted: %q", stub.sentArg.Body)
	}
	if res.Body != "hola mundo" || !res.IsMine {
		t.Fatalf("response = %+v", res)
	}
	if !stub.touched || !stub.restored {
		t.Fatalf("expected touch and restore, got touched=%v restored=%v", stub.touched, stub.restored)
	}
}

func TestChatServiceMessagesReadAndDeleteErrors(t *testing.T) {
	t.Parallel()

	customerID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	itemID := uuid.MustParse("22222222-2222-2222-2222-222222222222")
	conversationID := uuid.MustParse("44444444-4444-4444-4444-444444444444")
	messageID := uuid.MustParse("55555555-5555-5555-5555-555555555555")
	stub := &chatQuerierStub{
		markReadIDs: []uuid.UUID{messageID},
		deleteErr:   pgx.ErrNoRows,
	}
	svc := newTestChatService(t, stub)
	stub.conversation = testConversationRow(t, svc, conversationID, itemID, customerID, "")

	read, err := svc.MarkMessagesRead(context.Background(), customerID, conversationID)
	if err != nil {
		t.Fatalf("MarkMessagesRead returned error: %v", err)
	}
	if len(read.MessageIDs) != 1 || read.MessageIDs[0] != messageID.String() {
		t.Fatalf("read receipt = %+v", read)
	}

	if err := svc.DeleteConversation(context.Background(), customerID, conversationID); !errors.Is(err, ErrConversationNotFound) {
		t.Fatalf("DeleteConversation error = %v, want %v", err, ErrConversationNotFound)
	}
}

func newTestChatService(t *testing.T, q chatQuerier) *ChatService {
	t.Helper()

	svc, err := NewChatService(q, []byte("12345678901234567890123456789012"))
	if err != nil {
		t.Fatalf("NewChatService returned error: %v", err)
	}
	return svc
}

func testConversationRow(
	t *testing.T,
	svc *ChatService,
	conversationID uuid.UUID,
	itemID uuid.UUID,
	otherUserID uuid.UUID,
	lastMessage string,
) sqlcdb.ConversationRow {
	t.Helper()

	price, err := float64ToNumeric(12.5)
	if err != nil {
		t.Fatalf("price numeric: %v", err)
	}
	encryptedLastMessage := ""
	if lastMessage != "" {
		encryptedLastMessage, err = svc.cipher.Encrypt(lastMessage)
		if err != nil {
			t.Fatalf("encrypt last message: %v", err)
		}
	}
	now := time.Date(2026, 6, 1, 12, 0, 0, 0, time.UTC)
	return sqlcdb.ConversationRow{
		ConversationID:              conversationID,
		ItemID:                      itemID,
		ItemTitle:                   "Taladro",
		ItemPrice:                   price,
		OtherUserID:                 otherUserID,
		OtherUserName:               "Lucia Perez",
		OtherUserVerificationStatus: sqlcdb.VerificationStatusVerified,
		LastMessage:                 encryptedLastMessage,
		LastMessageAt:               pgtype.Timestamptz{Time: now, Valid: lastMessage != ""},
		UpdatedAt:                   pgtype.Timestamptz{Time: now, Valid: true},
		UnreadCount:                 2,
	}
}
