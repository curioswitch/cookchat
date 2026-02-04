// Copyright (c) CurioSwitch (choko@curioswitch.org)
// SPDX-License-Identifier: BUSL-1.1

package getchatmessages

import (
	"context"
	"errors"
	"fmt"

	"cloud.google.com/go/firestore"
	"github.com/curioswitch/go-usegcp/middleware/firebaseauth"
	"google.golang.org/api/iterator"

	"github.com/curioswitch/cookchat/common/cookchatdb"
	frontendapi "github.com/curioswitch/cookchat/frontend/api/go"
)

func NewHandler(store *firestore.Client) *Handler {
	return &Handler{
		store: store,
	}
}

type Handler struct {
	store *firestore.Client
}

func (h *Handler) GetChatMessages(ctx context.Context, _ *frontendapi.GetChatMessagesRequest) (*frontendapi.GetChatMessagesResponse, error) {
	userID := firebaseauth.TokenFromContext(ctx).UID

	chats := h.store.Collection("users").Doc(userID).Collection("chats")
	var chat cookchatdb.Chat
	lastChat, err := chats.Query.OrderBy("createdAt", firestore.Desc).Limit(1).Documents(ctx).Next()
	if err != nil && !errors.Is(err, iterator.Done) {
		return nil, fmt.Errorf("chatplan: getting last chat document: %w", err)
	}
	if lastChat != nil {
		if err := lastChat.DataTo(&chat); err != nil {
			return nil, fmt.Errorf("chatplan: decoding last chat document: %w", err)
		}
	}
	if chat.PlanID != "" {
		return &frontendapi.GetChatMessagesResponse{}, nil
	}

	messages := make([]*frontendapi.ChatMessage, len(chat.Messages))
	for i, msg := range chat.Messages {
		role := frontendapi.ChatMessage_ROLE_USER
		if msg.Role == cookchatdb.ChatRoleAssistant {
			role = frontendapi.ChatMessage_ROLE_ASSISTANT
		}
		messages[i] = &frontendapi.ChatMessage{
			Role:    role,
			Content: msg.Content,
		}
	}
	return &frontendapi.GetChatMessagesResponse{
		ChatId:   chat.ID,
		Messages: messages,
	}, nil
}
