// Copyright (c) CurioSwitch (choko@curioswitch.org)
// SPDX-License-Identifier: BUSL-1.1

package addbookmark

import (
	"context"
	"fmt"
	"time"

	"cloud.google.com/go/firestore"
	"github.com/curioswitch/go-usegcp/middleware/firebaseauth"

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

func (h *Handler) AddBookmark(ctx context.Context, req *frontendapi.AddBookmarkRequest) (*frontendapi.AddBookmarkResponse, error) {
	bookmark := cookchatdb.RecipeBookmark{
		RecipeID:  req.GetRecipeId(),
		CreatedAt: time.Now(),
	}

	doc := h.store.Collection("users").Doc(firebaseauth.TokenFromContext(ctx).UID).Collection("bookmarks").Doc("recipe-" + req.GetRecipeId())
	if _, err := doc.Set(ctx, bookmark); err != nil {
		return nil, fmt.Errorf("addbookmark: saving bookmark: %w", err)
	}
	return &frontendapi.AddBookmarkResponse{}, nil
}
