// Copyright (c) CurioSwitch (choko@curioswitch.org)
// SPDX-License-Identifier: BUSL-1.1

package generateplan

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	discoveryengine "cloud.google.com/go/discoveryengine/apiv1"
	"cloud.google.com/go/firestore"
	"github.com/curioswitch/go-usegcp/middleware/firebaseauth"
	"golang.org/x/sync/errgroup"
	"google.golang.org/api/iterator"
	"google.golang.org/genai"
	"google.golang.org/protobuf/encoding/protojson"

	"github.com/curioswitch/cookchat/common/cookchatdb"
	frontendapi "github.com/curioswitch/cookchat/frontend/api/go"
	"github.com/curioswitch/cookchat/frontend/server/internal/llm"
)

func NewHandler(genAI *genai.Client, store *firestore.Client, search *discoveryengine.SearchClient) *Handler {
	return &Handler{
		genAI:  genAI,
		store:  store,
		search: search,
	}
}

type Handler struct {
	genAI  *genai.Client
	store  *firestore.Client
	search *discoveryengine.SearchClient
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

	res, err := h.genAI.Models.GenerateContent(ctx, "gemini-2.5-flash", content, &genai.GenerateContentConfig{
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
		return nil, fmt.Errorf("generateplan: calling GenerateContent for plan: %w", err)
	}
	if len(res.Candidates) != 1 || len(res.Candidates[0].Content.Parts) != 1 || res.Candidates[0].Content.Parts[0].Text == "" {
		return nil, fmt.Errorf("generateplan: unexpected response from generate ai for plan: %v", res)
	}

	var plans []cookchatdb.Plan
	if err := json.Unmarshal([]byte(res.Candidates[0].Content.Parts[0].Text), &plans); err != nil {
		return nil, fmt.Errorf("generateplan: failed to unmarshal received plan: %w", err)
	}
	if len(plans) != int(req.GetNumDays()) {
		return nil, fmt.Errorf("generateplan: unexpected number of days in plan: got %d, want %d", len(plans), req.GetNumDays())
	}

	var grp errgroup.Group
	for i, plan := range plans {
		if len(plan.Recipes) > 3 {
			plan.Recipes = plan.Recipes[:3]
		}
		grp.Go(func() error {
			filled, err := h.fillPlan(ctx, plan)
			if err != nil {
				return fmt.Errorf("generateplan: filling plan for day %d: %w", i, err)
			}
			plans[i] = filled
			return nil
		})
	}
	if err := grp.Wait(); err != nil {
		return nil, fmt.Errorf("generateplan: filling plans: %w", err)
	}

	now := time.Now()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)

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

func (h *Handler) fillPlan(ctx context.Context, plan cookchatdb.Plan) (cookchatdb.Plan, error) {
	recipeDocs, err := h.store.Collection("recipes").Query.WhereEntity(firestore.PropertyFilter{
		Path: "id", Operator: "in", Value: plan.Recipes,
	}).Documents(ctx).GetAll()
	if err != nil {
		return plan, fmt.Errorf("generateplan: fetching recipes for plan: %w", err)
	}

	content := make([]*genai.Content, len(recipeDocs))
	for i, doc := range recipeDocs {
		recipeJSON, err := json.Marshal(doc.Data())
		if err != nil {
			return plan, fmt.Errorf("generateplan: marshalling recipe document to JSON: %w", err)
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
		return plan, fmt.Errorf("generateplan: calling GenerateContent for execution plan: %w", err)
	}
	if len(res.Candidates) != 1 || len(res.Candidates[0].Content.Parts) != 1 || res.Candidates[0].Content.Parts[0].Text == "" {
		return plan, fmt.Errorf("generateplan: unexpected response from generate ai for execution plan: %v", res)
	}
	if err := json.Unmarshal([]byte(res.Candidates[0].Content.Parts[0].Text), &plan); err != nil {
		return plan, fmt.Errorf("generateplan: failed to unmarshal received plan: %w", err)
	}
	return plan, nil
}
