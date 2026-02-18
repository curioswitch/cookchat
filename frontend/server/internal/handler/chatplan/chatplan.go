// Copyright (c) CurioSwitch (choko@curioswitch.org)
// SPDX-License-Identifier: BUSL-1.1

package chatplan

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"maps"
	"slices"
	"strings"
	"time"

	discoveryengine "cloud.google.com/go/discoveryengine/apiv1"
	"cloud.google.com/go/firestore"
	"github.com/cenkalti/backoff/v5"
	"github.com/curioswitch/go-usegcp/middleware/firebaseauth"
	"golang.org/x/sync/errgroup"
	"google.golang.org/api/iterator"
	"google.golang.org/genai"

	"github.com/curioswitch/cookchat/common/cookchatdb"
	"github.com/curioswitch/cookchat/common/recipegen"
	frontendapi "github.com/curioswitch/cookchat/frontend/api/go"
	"github.com/curioswitch/cookchat/frontend/server/internal/i18n"
	"github.com/curioswitch/cookchat/frontend/server/internal/llm"
)

func NewHandler(genAI *genai.Client, store *firestore.Client, search *discoveryengine.SearchClient, processor *recipegen.PostProcessor) *Handler {
	return &Handler{
		genAI:     genAI,
		store:     store,
		search:    search,
		processor: processor,
	}
}

type Handler struct {
	genAI     *genai.Client
	store     *firestore.Client
	search    *discoveryengine.SearchClient
	processor *recipegen.PostProcessor
}

func (h *Handler) ChatPlan(ctx context.Context, req *frontendapi.ChatPlanRequest) (*frontendapi.ChatPlanResponse, error) {
	userID := firebaseauth.TokenFromContext(ctx).UID

	recentRecipes, err := h.getRecentRecipes(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("chatplan: getting recent recipes: %w", err)
	}

	now := time.Now()

	chats := h.store.Collection("users").Doc(userID).Collection("chats")
	var chat cookchatdb.Chat
	if cid := req.GetChatId(); cid != "" {
		doc, err := chats.Doc(cid).Get(ctx)
		if err != nil {
			return nil, fmt.Errorf("chatplan: getting chat document: %w", err)
		}
		if err := doc.DataTo(&chat); err != nil {
			return nil, fmt.Errorf("chatplan: decoding chat document: %w", err)
		}
	} else {
		foundChat := false
		if !req.GetNewChat() {
			lastChat, err := chats.Query.OrderBy("createdAt", firestore.Desc).Limit(1).Documents(ctx).Next()
			if err != nil && !errors.Is(err, iterator.Done) {
				return nil, fmt.Errorf("chatplan: getting last chat document: %w", err)
			}
			if lastChat != nil {
				if err := lastChat.DataTo(&chat); err != nil {
					return nil, fmt.Errorf("chatplan: decoding last chat document: %w", err)
				}
				if chat.PlanID == "" {
					foundChat = true
				}
			}
		}
		if !foundChat {
			cid := chats.NewDoc().ID
			chat = cookchatdb.Chat{
				ID:        cid,
				CreatedAt: now,
			}
		}
	}
	chat.UpdatedAt = now
	chat.Messages = append(chat.Messages, cookchatdb.ChatMessage{
		Role:    cookchatdb.ChatRoleUser,
		Content: req.GetMessage(),
	})

	content := make([]*genai.Content, len(chat.Messages))
	for i, message := range chat.Messages {
		role := genai.Role(genai.RoleUser)
		if message.Role == cookchatdb.ChatRoleAssistant {
			role = genai.RoleModel
		}
		content[i] = genai.NewContentFromText(message.Content, role)
	}

	res, err := backoff.Retry(ctx, func() (*genai.GenerateContentResponse, error) {
		res, err := h.genAI.Models.GenerateContent(ctx, "gemini-3-flash-preview", content, &genai.GenerateContentConfig{
			SystemInstruction: genai.NewContentFromText(llm.ChatPlanPrompt(strings.Join(recentRecipes, ", ")), genai.RoleModel),
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
		return res, nil
	})
	if err != nil {
		return nil, err
	}

	resText := strings.TrimSpace(res.Candidates[0].Content.Parts[0].Text)
	if _, resJSON, ok := strings.Cut(resText, "GENERATED MEAL PLAN\n"); ok {
		var plans [][]cookchatdb.RecipeContent
		if err := json.Unmarshal([]byte(resJSON), &plans); err != nil {
			return nil, fmt.Errorf("chatplan: error deserializing LLM JSON response: %w", err)
		}
		plan, err := h.savePlan(ctx, plans[0])
		if err != nil {
			return nil, err
		}
		planID := plan.ID

		chat.PlanID = planID
		if _, err := chats.Doc(chat.ID).Set(ctx, chat); err != nil {
			return nil, fmt.Errorf("chatplan: saving chat plan ID: %w", err)
		}
		return &frontendapi.ChatPlanResponse{
			ChatId: chat.ID,
			PlanId: planID,
		}, nil
	}

	chat.Messages = append(chat.Messages, cookchatdb.ChatMessage{
		Role:    cookchatdb.ChatRoleAssistant,
		Content: resText,
	})

	if _, err := chats.Doc(chat.ID).Set(ctx, chat); err != nil {
		return nil, fmt.Errorf("chatplan: saving chat document: %w", err)
	}

	messages := make([]*frontendapi.ChatMessage, len(chat.Messages))
	for i, message := range chat.Messages {
		msg := &frontendapi.ChatMessage{
			Content: message.Content,
		}
		switch message.Role {
		case cookchatdb.ChatRoleUser:
			msg.Role = frontendapi.ChatMessage_ROLE_USER
		case cookchatdb.ChatRoleAssistant:
			msg.Role = frontendapi.ChatMessage_ROLE_ASSISTANT
		}
		messages[i] = msg
	}
	message := messages[len(messages)-1]
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

	return &frontendapi.ChatPlanResponse{
		ChatId:   chat.ID,
		Messages: messages,
	}, nil
}

func (h *Handler) savePlan(ctx context.Context, recipeContents []cookchatdb.RecipeContent) (cookchatdb.Plan, error) {
	recipes := make([]cookchatdb.Recipe, len(recipeContents))

	language := i18n.UserLanguage(ctx)
	var grp errgroup.Group
	for i, content := range recipeContents {
		grp.Go(func() error {
			recipeID := h.store.Collection("recipes").NewDoc().ID
			recipe := cookchatdb.Recipe{
				ID:           recipeID,
				Source:       cookchatdb.RecipeSourceAI,
				Content:      content,
				LanguageCode: language,
			}
			recipes[i] = recipe

			rDoc := h.store.Collection("recipes").Doc("chatplan-" + recipe.ID)
			if _, err := rDoc.Create(ctx, recipe); err != nil {
				return fmt.Errorf("chatplan: saving recipe %q: %w", recipe.ID, err)
			}

			return nil
		})
	}
	if err := grp.Wait(); err != nil {
		return cookchatdb.Plan{}, err
	}

	plan, err := h.generatePlan(ctx, recipes)
	if err != nil {
		return plan, fmt.Errorf("chatplan: generating plan from recipes: %w", err)
	}

	userID := firebaseauth.TokenFromContext(ctx).UID

	plansCol := h.store.Collection("users").Doc(userID).Collection("plans")
	planDoc := plansCol.NewDoc()
	plan.ID = planDoc.ID
	plan.CreatedAt = time.Now()
	if _, err := planDoc.Set(ctx, plan); err != nil {
		return plan, fmt.Errorf("chatplan: failed to set plan document: %w", err)
	}

	return plan, nil
}

type contentWithID struct {
	RecipeID string                   `json:"recipeId"`
	Content  cookchatdb.RecipeContent `json:"content"`
}

func (h *Handler) generatePlan(ctx context.Context, recipes []cookchatdb.Recipe) (cookchatdb.Plan, error) {
	var plan cookchatdb.Plan

	content := make([]*genai.Content, len(recipes))
	for i, recipe := range recipes {
		recipeJSON, err := json.Marshal(contentWithID{
			RecipeID: recipe.ID,
			Content:  recipe.Content,
		})
		if err != nil {
			return plan, fmt.Errorf("generateplan: marshalling recipe document to JSON: %w", err)
		}
		content[i] = genai.NewContentFromText(string(recipeJSON), genai.RoleUser)
	}

	res, err := h.genAI.Models.GenerateContent(ctx, "gemini-3-flash-preview", content, &genai.GenerateContentConfig{
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

func (h *Handler) getRecentRecipes(ctx context.Context, userID string) ([]string, error) {
	now := time.Now()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	start := today.Add(-2 * 7 * 24 * time.Hour)

	plansCol := h.store.Collection("users").Doc(userID).Collection("plans")
	iter := plansCol.Query.WhereEntity(firestore.AndFilter{
		Filters: []firestore.EntityFilter{
			firestore.PropertyFilter{
				Path:     firestore.DocumentID,
				Operator: ">=",
				Value:    plansCol.Doc(start.Format(time.DateOnly)),
			},
			firestore.PropertyFilter{
				Path:     firestore.DocumentID,
				Operator: "<=",
				Value:    plansCol.Doc(today.Format(time.DateOnly)),
			},
		},
	}).Documents(ctx)
	defer iter.Stop()

	recipeIDs := make(map[string]struct{})
	for {
		doc, err := iter.Next()
		if errors.Is(err, iterator.Done) {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("chatplan: fetching plan: %w", err)
		}

		var plan cookchatdb.Plan
		if err := doc.DataTo(&plan); err != nil {
			return nil, fmt.Errorf("chatplan: decoding plan: %w", err)
		}
		for _, recipeID := range plan.Recipes {
			recipeIDs[recipeID] = struct{}{}
		}
	}

	var recipeTitles []string
	if len(recipeIDs) == 0 {
		return recipeTitles, nil
	}

	recipesCol := h.store.Collection("recipes")
	iter = recipesCol.Query.WhereEntity(firestore.PropertyFilter{
		Path:     "id",
		Operator: "in",
		Value:    slices.Collect(maps.Keys(recipeIDs)),
	}).Documents(ctx)
	defer iter.Stop()

	for {
		doc, err := iter.Next()
		if errors.Is(err, iterator.Done) {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("chatplan: fetching recipe: %w", err)
		}
		var recipe cookchatdb.Recipe
		if err := doc.DataTo(&recipe); err != nil {
			return nil, fmt.Errorf("chatplan: decoding recipe: %w", err)
		}
		recipeTitles = append(recipeTitles, recipe.Content.Title)
	}

	return recipeTitles, nil
}
