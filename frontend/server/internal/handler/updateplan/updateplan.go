// Copyright (c) CurioSwitch (choko@curioswitch.org)
// SPDX-License-Identifier: BUSL-1.1

package updateplan

import (
	"context"
	"encoding/json"
	"fmt"

	"cloud.google.com/go/firestore"
	"github.com/curioswitch/go-usegcp/middleware/firebaseauth"
	"google.golang.org/genai"

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

func (h *Handler) UpdatePlan(ctx context.Context, req *frontendapi.UpdatePlanRequest) (*frontendapi.UpdatePlanResponse, error) {
	rDocs, err := h.store.Collection("recipes").Query.WhereEntity(firestore.PropertyFilter{
		Path: "id", Operator: "in", Value: req.GetRecipeIds(),
	}).Documents(ctx).GetAll()
	if err != nil {
		return nil, fmt.Errorf("updateplan: fetching recipes for plan: %w", err)
	}
	recipes := make([]cookchatdb.Recipe, len(rDocs))
	for i, doc := range rDocs {
		if err := doc.DataTo(&recipes[i]); err != nil {
			return nil, fmt.Errorf("updateplan: failed to unmarshal recipe document: %w", err)
		}
	}

	plan, err := h.fillPlan(ctx, cookchatdb.Plan{
		ID:      req.GetPlanId(),
		Recipes: req.GetRecipeIds(),
	})
	if err != nil {
		return nil, err
	}

	userID := firebaseauth.TokenFromContext(ctx).UID
	plansCol := h.store.Collection("users").Doc(userID).Collection("plans")
	planID := plan.ID
	planDoc := plansCol.Doc(planID)
	if _, err := planDoc.Set(ctx, plan); err != nil {
		return nil, fmt.Errorf("updateplan: failed to set plan document: %w", err)
	}

	return &frontendapi.UpdatePlanResponse{}, nil
}

func (h *Handler) fillPlan(ctx context.Context, plan cookchatdb.Plan) (cookchatdb.Plan, error) {
	recipeDocs, err := h.store.Collection("recipes").Query.WhereEntity(firestore.PropertyFilter{
		Path: "id", Operator: "in", Value: plan.Recipes,
	}).Documents(ctx).GetAll()
	if err != nil {
		return plan, fmt.Errorf("updateplan: fetching recipes for plan: %w", err)
	}

	content := make([]*genai.Content, len(recipeDocs))
	for i, doc := range recipeDocs {
		recipeJSON, err := json.Marshal(doc.Data())
		if err != nil {
			return plan, fmt.Errorf("updateplan: marshalling recipe document to JSON: %w", err)
		}
		content[i] = genai.NewContentFromText(string(recipeJSON), genai.RoleUser)
	}

	res, err := h.genAI.Models.GenerateContent(ctx, "gemini-2.5-flash", content, &genai.GenerateContentConfig{
		SystemInstruction: genai.NewContentFromText(llm.GenerateExecutionPlanPrompt(), genai.RoleModel),
		ResponseMIMEType:  "application/json",
		ResponseSchema: &genai.Schema{
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
				"stepGroups": {
					Type:        "array",
					Description: "The groups of recipe steps to make the plan.",
					Items: &genai.Schema{
						Type: "object",
						Properties: map[string]*genai.Schema{
							"label": {
								Type:        "string",
								Description: "The label of the step group, e.g. 準備, 調理, 仕上げ.",
							},
							"steps": {
								Type:        "array",
								Description: "The steps in the step group.",
								Items: &genai.Schema{
									Type: "object",
									Properties: map[string]*genai.Schema{
										"description": {
											Type:        "string",
											Description: "The description of the step.",
										},
										"imageUrl": {
											Type:        "string",
											Description: "The image URL for the step.",
										},
									},
									Required: []string{"description"},
								},
							},
							"note": {
								Type:        "string",
								Description: "Any note that can help when doing the steps in the group, such as what to do while waiting for one",
							},
						},
						Required: []string{"label", "steps"},
					},
				},
				"notes": {
					Type:        "array",
					Description: "Any useful notes for preparing the plan",
					Items: &genai.Schema{
						Type: "string",
					},
				},
			},
			Required: []string{"recipes", "stepGroups"},
		},
	})
	if err != nil {
		return plan, fmt.Errorf("updateplan: calling GenerateContent for execution plan: %w", err)
	}
	if len(res.Candidates) != 1 || len(res.Candidates[0].Content.Parts) != 1 || res.Candidates[0].Content.Parts[0].Text == "" {
		return plan, fmt.Errorf("updateplan: unexpected response from generate ai for execution plan: %v", res)
	}
	if err := json.Unmarshal([]byte(res.Candidates[0].Content.Parts[0].Text), &plan); err != nil {
		return plan, fmt.Errorf("updateplan: failed to unmarshal received plan: %w", err)
	}
	return plan, nil
}
