// Copyright (c) CurioSwitch (choko@curioswitch.org)
// SPDX-License-Identifier: BUSL-1.1

package getuser

import (
	"context"
	"fmt"

	"cloud.google.com/go/firestore"
	"github.com/curioswitch/go-usegcp/middleware/firebaseauth"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

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

func (h *Handler) GetUser(ctx context.Context, _ *frontendapi.GetUserRequest) (*frontendapi.GetUserResponse, error) {
	userID := firebaseauth.TokenFromContext(ctx).UID
	userDoc := h.store.Collection("users").Doc(userID)
	doc, err := userDoc.Get(ctx)
	if status.Code(err) == codes.NotFound {
		return &frontendapi.GetUserResponse{}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("getuser: getting user from firestore: %w", err)
	}
	var user cookchatdb.User
	if err := doc.DataTo(&user); err != nil {
		return nil, fmt.Errorf("getuser: deserializing firestore user: %w", err)
	}
	return &frontendapi.GetUserResponse{
		PlanPrompt: user.PlanPrompt,
	}, nil
}
