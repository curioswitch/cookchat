// Copyright (c) CurioSwitch (choko@curioswitch.org)
// SPDX-License-Identifier: BUSL-1.1

package generaterecipe

import (
	"context"
	"encoding/json"
	"fmt"

	"cloud.google.com/go/firestore"
	"cloud.google.com/go/storage"
	"google.golang.org/genai"

	"github.com/curioswitch/cookchat/common/cookchatdb"
	frontendapi "github.com/curioswitch/cookchat/frontend/api/go"
	"github.com/curioswitch/cookchat/frontend/server/internal/llm"
)

func NewHandler(genAI *genai.Client, store *firestore.Client, storage *storage.Client, publicBucket string) *Handler {
	return &Handler{
		genAI:        genAI,
		store:        store,
		storage:      storage,
		publicBucket: publicBucket,
	}
}

type Handler struct {
	genAI        *genai.Client
	store        *firestore.Client
	storage      *storage.Client
	publicBucket string
}

func (h *Handler) GenerateRecipe(ctx context.Context, req *frontendapi.GenerateRecipeRequest) (*frontendapi.GenerateRecipeResponse, error) {
	res, err := h.genAI.Models.GenerateContent(ctx, "gemini-2.5-pro", []*genai.Content{
		genai.NewContentFromText(req.GetPrompt(), genai.RoleUser),
	}, &genai.GenerateContentConfig{
		SystemInstruction: genai.NewContentFromText(llm.GenerateRecipePrompt(), genai.RoleModel),
		ResponseMIMEType:  "application/json",
		ResponseSchema:    cookchatdb.RecipeContentSchema,
	})
	if err != nil {
		return nil, fmt.Errorf("generaterecipe: generating content: %w", err)
	}
	if len(res.Candidates) != 1 || len(res.Candidates[0].Content.Parts) != 1 || res.Candidates[0].Content.Parts[0].Text == "" {
		return nil, fmt.Errorf("generaterecipe: unexpected response from generate ai: %v", res)
	}
	text := res.Candidates[0].Content.Parts[0].Text
	var recipe cookchatdb.RecipeContent
	if err := json.Unmarshal([]byte(text), &recipe); err != nil {
		return nil, fmt.Errorf("generaterecipe: failed to unmarshal content: %w", err)
	}

	addRecipe := &frontendapi.AddRecipeRequest{
		Title:       recipe.Title,
		Description: recipe.Description,
		ServingSize: recipe.ServingSize,
	}
	addRecipe.Ingredients = make([]*frontendapi.RecipeIngredient, len(recipe.Ingredients))
	for i, ingredient := range recipe.Ingredients {
		addRecipe.Ingredients[i] = &frontendapi.RecipeIngredient{
			Name:     ingredient.Name,
			Quantity: ingredient.Quantity,
		}
	}
	for _, section := range recipe.AdditionalIngredients {
		sectionReq := &frontendapi.IngredientSection{
			Title: section.Title,
		}
		sectionReq.Ingredients = make([]*frontendapi.RecipeIngredient, len(section.Ingredients))
		for i, ingredient := range section.Ingredients {
			sectionReq.Ingredients[i] = &frontendapi.RecipeIngredient{
				Name:     ingredient.Name,
				Quantity: ingredient.Quantity,
			}
		}
		addRecipe.AdditionalIngredients = append(addRecipe.AdditionalIngredients, sectionReq)
	}
	for _, step := range recipe.Steps {
		addRecipe.Steps = append(addRecipe.Steps, &frontendapi.AddRecipeRequest_AddRecipeStep{
			Description: step.Description,
		})
	}

	return &frontendapi.GenerateRecipeResponse{
		AddRecipeRequest: addRecipe,
	}, nil
}
