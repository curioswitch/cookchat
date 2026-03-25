// Copyright (c) CurioSwitch (choko@curioswitch.org)
// SPDX-License-Identifier: BUSL-1.1

package deleteplan

import (
	"context"
	"fmt"

	"cloud.google.com/go/firestore"
	"github.com/curioswitch/go-usegcp/middleware/firebaseauth"
	"google.golang.org/genai"

	frontendapi "github.com/curioswitch/cookchat/frontend/api/go"
)

func NewHandler(genAI *genai.Client, store *firestore.Client) *Handler {
	return &Handler{
		genAI: genAI,
		store: store,
	}
}

type Handler struct {
	genAI *genai.Client
	store *firestore.Client
}

func (h *Handler) DeletePlan(ctx context.Context, req *frontendapi.DeletePlanRequest) (*frontendapi.DeletePlanResponse, error) {
	userID := firebaseauth.TokenFromContext(ctx).UID
	plansCol := h.store.Collection("users").Doc(userID).Collection("plans")

	planID := req.GetPlanId()
	planDoc := plansCol.Doc(planID)
	if _, err := planDoc.Delete(ctx); err != nil {
		return nil, fmt.Errorf("deleteplan: failed to delete plan document: %w", err)
	}

	return &frontendapi.DeletePlanResponse{}, nil
}
