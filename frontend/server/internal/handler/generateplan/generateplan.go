// Copyright (c) CurioSwitch (choko@curioswitch.org)
// SPDX-License-Identifier: BUSL-1.1

package generateplan

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"cloud.google.com/go/firestore"
	"github.com/curioswitch/go-usegcp/middleware/firebaseauth"
	"google.golang.org/api/iterator"
	"google.golang.org/genai"
	"google.golang.org/protobuf/encoding/protojson"

	"github.com/curioswitch/cookchat/common/cookchatdb"
	frontendapi "github.com/curioswitch/cookchat/frontend/api/go"
	"github.com/curioswitch/cookchat/frontend/server/internal/llm"
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

func (h *Handler) GeneratePlan(ctx context.Context, req *frontendapi.GeneratePlanRequest) (*frontendapi.GeneratePlanResponse, error) {
	recipeDocs := h.store.Collection("recipes").Query.Select("id", "title", "description", "ingredients", "additionalIngredients", "notes").Documents(ctx)

	var content []*genai.Content

	reqJSONBytes, err := protojson.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("generateplan: marshalling user request to JSON: %w", err)
	}
	content = append(content, genai.NewContentFromText(string(reqJSONBytes), genai.RoleUser))

	for {
		doc, err := recipeDocs.Next()
		if errors.Is(err, iterator.Done) {
			break
		}

		recipeJSON, err := json.Marshal(doc.Data())
		if err != nil {
			return nil, fmt.Errorf("generateplan: marshalling recipe document to JSON: %w", err)
		}
		content = append(content, genai.NewContentFromText(string(recipeJSON), genai.RoleUser))
	}

	res, err := h.genAI.Models.GenerateContent(ctx, "gemini-2.5-pro", content, &genai.GenerateContentConfig{
		SystemInstruction: genai.NewContentFromText(llm.GeneratePlanPrompt(), genai.RoleModel),
		ResponseMIMEType:  "application/json",
		ResponseSchema: &genai.Schema{
			Type:        "array",
			Description: "The days of the meal plan.",
			Items: &genai.Schema{
				Type:        "object",
				Description: "The recipes of a day in the meal plan.",
				Properties: map[string]*genai.Schema{
					"recipes": {
						Type:        "array",
						Description: "The recipe IDs for the day.",
						Items: &genai.Schema{
							Type: "string",
						},
					},
				},
				Required: []string{"recipes"},
			},
		},
	})
	if err != nil {
		return nil, fmt.Errorf("generateplan: calling GenerateContent: %w", err)
	}
	if len(res.Candidates) != 1 || len(res.Candidates[0].Content.Parts) != 1 || res.Candidates[0].Content.Parts[0].Text == "" {
		return nil, fmt.Errorf("generateplan: unexpected response from generate ai: %v", res)
	}

	var plans []cookchatdb.Plan
	if err := json.Unmarshal([]byte(res.Candidates[0].Content.Parts[0].Text), &plans); err != nil {
		return nil, fmt.Errorf("generateplan: failed to unmarshal received plan: %w", err)
	}
	if len(plans) != int(req.GetNumDays()) {
		return nil, fmt.Errorf("generateplan: unexpected number of days in plan: got %d, want %d", len(plans), req.GetNumDays())
	}

	now := time.Now()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())

	userID := firebaseauth.TokenFromContext(ctx).UID

	if err := h.store.RunTransaction(ctx, func(_ context.Context, t *firestore.Transaction) error {
		plansCol := h.store.Collection("users").Doc(userID).Collection("plans")
		for i, plan := range plans {
			plan.Date = today.AddDate(0, 0, i)
			planID := plan.Date.Format(time.DateOnly)
			planDoc := plansCol.Doc(planID)
			if err := t.Set(planDoc, plan); err != nil {
				return fmt.Errorf("generateplan: failed to set plan document: %w", err)
			}
		}
		return nil
	}); err != nil {
		return nil, fmt.Errorf("generateplan: save plans: %w", err)
	}

	return &frontendapi.GeneratePlanResponse{}, nil
}
