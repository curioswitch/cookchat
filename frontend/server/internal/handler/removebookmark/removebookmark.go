// Copyright (c) CurioSwitch (choko@curioswitch.org)
// SPDX-License-Identifier: BUSL-1.1

package removebookmark

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

func (h *Handler) RemoveBookmark(ctx context.Context, req *frontendapi.RemoveBookmarkRequest) (*frontendapi.RemoveBookmarkResponse, error) {
	doc := h.store.Collection("users").Doc(firebaseauth.TokenFromContext(ctx).UID).Collection("bookmarks").Doc("recipe-" + req.GetRecipeId())
	if _, err := doc.Delete(ctx); err != nil {
		return nil, fmt.Errorf("removebookmark: deleting bookmark: %w", err)
	}
	return &frontendapi.RemoveBookmarkResponse{}, nil
}
