// Copyright (c) CurioSwitch (choko@curioswitch.org)
// SPDX-License-Identifier: BUSL-1.1

package edituser

import (
	"context"
	"fmt"

	"cloud.google.com/go/firestore"
	"github.com/curioswitch/go-usegcp/middleware/firebaseauth"

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

func (h *Handler) EditUser(ctx context.Context, req *frontendapi.EditUserRequest) (*frontendapi.EditUserResponse, error) {
	userID := firebaseauth.TokenFromContext(ctx).UID
	userDoc := h.store.Collection("users").Doc(userID)
	updates := make(map[string]any)

	if req.PlanPrompt != nil {
		updates["planPrompt"] = req.GetPlanPrompt()
	}

	if len(updates) > 0 {
		if _, err := userDoc.Set(ctx, updates, firestore.MergeAll); err != nil {
			return nil, fmt.Errorf("edituser: saving user: %w", err)
		}
	}
	return &frontendapi.EditUserResponse{}, nil
}
