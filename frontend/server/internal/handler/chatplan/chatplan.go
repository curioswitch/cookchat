// Copyright (c) CurioSwitch (choko@curioswitch.org)
// SPDX-License-Identifier: BUSL-1.1

package chatplan

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	discoveryengine "cloud.google.com/go/discoveryengine/apiv1"
	"cloud.google.com/go/firestore"
	"github.com/curioswitch/go-usegcp/middleware/firebaseauth"
	"google.golang.org/genai"

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

func (h *Handler) ChatPlan(ctx context.Context, req *frontendapi.ChatPlanRequest) (*frontendapi.ChatPlanResponse, error) {
	content := make([]*genai.Content, len(req.GetMessages()))
	for i, message := range req.GetMessages() {
		role := genai.Role(genai.RoleUser)
		if message.GetRole() == frontendapi.ChatMessage_ROLE_ASSISTANT {
			role = genai.RoleModel
		}
		content[i] = genai.NewContentFromText(message.GetContent(), role)
	}

	res, err := h.genAI.Models.GenerateContent(ctx, "gemini-2.5-flash", content, &genai.GenerateContentConfig{
		SystemInstruction: genai.NewContentFromText(llm.ChatPlanPrompt(), genai.RoleModel),
		Tools: []*genai.Tool{
			{
				GoogleSearch: &genai.GoogleSearch{},
			},
		},
	})
	if err != nil {
		return nil, fmt.Errorf("chatplan: calling GenerateContent for plan: %w", err)
	}
	if len(res.Candidates) != 1 || len(res.Candidates[0].Content.Parts) != 1 || res.Candidates[0].Content.Parts[0].Text == "" {
		return nil, fmt.Errorf("chatplan: unexpected response from generate ai for plan: %v", res)
	}
	resText := strings.TrimSpace(res.Candidates[0].Content.Parts[0].Text)
	if _, resJSON, ok := strings.Cut(resText, "GENERATED MEAL PLAN\n"); ok {
		plan, err := h.savePlan(ctx, resJSON)
		if err != nil {
			return nil, err
		}
		planID := plan.Date.Format(time.DateOnly)

		return &frontendapi.ChatPlanResponse{
			PlanId: planID,
		}, nil
	}

	messages := append([]*frontendapi.ChatMessage{}, req.GetMessages()...)
	message := &frontendapi.ChatMessage{
		Role:    frontendapi.ChatMessage_ROLE_ASSISTANT,
		Content: resText,
	}
	if cm := res.Candidates[0].CitationMetadata; cm != nil {
		for _, citation := range cm.Citations {
			if u := citation.URI; u != "" {
				message.Urls = append(message.Urls, u)
			}
		}
	}
	if gm := res.Candidates[0].GroundingMetadata; gm != nil {
		for _, g := range gm.GroundingChunks {
			if w := g.Web; w != nil {
				if u := w.URI; u != "" {
					message.Urls = append(message.Urls, u)
				}
			}
		}
	}
	messages = append(messages, message)

	return &frontendapi.ChatPlanResponse{
		Messages: messages,
	}, nil
}

func (h *Handler) savePlan(ctx context.Context, resJSON string) (cookchatdb.Plan, error) {
	var recipeContents []cookchatdb.RecipeContent
	if err := json.Unmarshal([]byte(resJSON), &recipeContents); err != nil {
		return cookchatdb.Plan{}, fmt.Errorf("chatplan: error deserializing LLM JSON response: %w", err)
	}
	recipes := make([]cookchatdb.Recipe, len(recipeContents))
	for i, rc := range recipeContents {
		recipes[i] = cookchatdb.Recipe{
			Title:       rc.Title,
			Description: rc.Description,
			ServingSize: rc.ServingSize,
			Content:     rc,
		}
		for _, ingredient := range rc.Ingredients {
			recipes[i].Ingredients = append(recipes[i].Ingredients, cookchatdb.RecipeIngredient{
				Name:     ingredient.Name,
				Quantity: ingredient.Quantity,
			})
		}
		for _, section := range rc.AdditionalIngredients {
			ingSection := cookchatdb.IngredientSection{
				Title: section.Title,
			}
			for _, ingredient := range section.Ingredients {
				ingSection.Ingredients = append(ingSection.Ingredients, cookchatdb.RecipeIngredient{
					Name:     ingredient.Name,
					Quantity: ingredient.Quantity,
				})
			}
			recipes[i].AdditionalIngredients = append(recipes[i].AdditionalIngredients, ingSection)
		}
		for _, step := range rc.Steps {
			recipes[i].Steps = append(recipes[i].Steps, cookchatdb.RecipeStep{
				Description: step.Description,
				ImageURL:    step.ImageURL,
			})
		}

		rDoc := h.store.Collection("recipes").NewDoc()
		rDoc.ID = "chatplan-" + rDoc.ID
		recipes[i].ID = rDoc.ID
		recipes[i].Source = cookchatdb.RecipeSourceAI
		if _, err := rDoc.Create(ctx, recipes[i]); err != nil {
			return cookchatdb.Plan{}, fmt.Errorf("chatplan: saving recipe %q: %w", recipes[i].Title, err)
		}
	}
	plan, err := h.generatePlan(ctx, recipes)
	if err != nil {
		return plan, fmt.Errorf("chatplan: generating plan from recipes: %w", err)
	}

	now := time.Now()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	userID := firebaseauth.TokenFromContext(ctx).UID

	plansCol := h.store.Collection("users").Doc(userID).Collection("plans")
	plan.Date = today
	planID := plan.Date.Format(time.DateOnly)
	planDoc := plansCol.Doc(planID)
	if _, err := planDoc.Set(ctx, plan); err != nil {
		return plan, fmt.Errorf("chatplan: failed to set plan document: %w", err)
	}

	return plan, nil
}

func (h *Handler) generatePlan(ctx context.Context, recipes []cookchatdb.Recipe) (cookchatdb.Plan, error) {
	var plan cookchatdb.Plan

	content := make([]*genai.Content, len(recipes))
	for i, recipe := range recipes {
		recipeJSON, err := json.Marshal(recipe)
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
