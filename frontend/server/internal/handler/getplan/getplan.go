// Copyright (c) CurioSwitch (choko@curioswitch.org)
// SPDX-License-Identifier: BUSL-1.1

package getplan

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"cloud.google.com/go/firestore"
	"google.golang.org/api/iterator"

	"github.com/curioswitch/cookchat/common/cookchatdb"
	frontendapi "github.com/curioswitch/cookchat/frontend/api/go"
	"github.com/curioswitch/cookchat/frontend/server/internal/auth"
	"github.com/curioswitch/cookchat/frontend/server/internal/i18n"
	"github.com/curioswitch/cookchat/frontend/server/internal/llm"
)

func NewHandler(store *firestore.Client) *Handler {
	return &Handler{
		store: store,
	}
}

type Handler struct {
	store *firestore.Client
}

func (h *Handler) GetPlan(ctx context.Context, req *frontendapi.GetPlanRequest) (*frontendapi.GetPlanResponse, error) {
	language := i18n.UserLanguage(ctx)

	doc, err := h.store.CollectionGroup("plans").Where("id", "==", req.GetPlanId()).Limit(1).Documents(ctx).Next()
	if err != nil && !errors.Is(err, iterator.Done) {
		return nil, fmt.Errorf("getplan: fetching plan: %w", err)
	}

	var dbPlan cookchatdb.Plan
	if err := doc.DataTo(&dbPlan); err != nil {
		return nil, fmt.Errorf("getplan: decoding plan: %w", err)
	}
	recipesCol := h.store.Collection("recipes")
	iter := recipesCol.Query.WhereEntity(firestore.PropertyFilter{
		Path:     "id",
		Operator: "in",
		Value:    dbPlan.Recipes,
	}).Documents(ctx)
	defer iter.Stop()

	recipes := make([]cookchatdb.Recipe, 0, len(dbPlan.Recipes))
	for {
		doc, err := iter.Next()
		if errors.Is(err, iterator.Done) {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("getplan: fetching recipe: %w", err)
		}
		var recipe cookchatdb.Recipe
		if err := doc.DataTo(&recipe); err != nil {
			return nil, fmt.Errorf("getplan: decoding recipe: %w", err)
		}
		recipes = append(recipes, recipe)
	}

	plan := &frontendapi.Plan{
		Id:           dbPlan.ID,
		Recipes:      make([]*frontendapi.RecipeSnippet, len(recipes)),
		Ingredients:  make([]*frontendapi.IngredientSection, len(recipes)),
		ServingSizes: make([]string, len(recipes)),
		StepGroups:   make([]*frontendapi.StepGroup, len(dbPlan.StepGroups)),
	}
	for i, recipe := range recipes {
		cnt := recipe.LocalizedContent[language]
		if cnt == nil {
			cnt = &recipe.Content
		}
		plan.Recipes[i] = &frontendapi.RecipeSnippet{
			Id:       recipe.ID,
			Title:    cnt.Title,
			Summary:  cnt.Description,
			ImageUrl: recipe.ImageURL,
		}
		plan.ServingSizes[i] = cnt.ServingSize
		sec := &frontendapi.IngredientSection{
			Title:       cnt.Title,
			Ingredients: make([]*frontendapi.RecipeIngredient, len(cnt.Ingredients)),
		}
		for i, ing := range cnt.Ingredients {
			sec.Ingredients[i] = &frontendapi.RecipeIngredient{
				Name:     ing.Name,
				Quantity: ing.Quantity,
			}
		}
		for _, add := range cnt.AdditionalIngredients {
			for _, ing := range add.Ingredients {
				sec.Ingredients = append(sec.Ingredients, &frontendapi.RecipeIngredient{
					Name:     ing.Name,
					Quantity: ing.Quantity,
				})
			}
		}
		plan.Ingredients[i] = sec
	}
	for i, dbStepGroup := range dbPlan.StepGroups {
		stepGroup := &frontendapi.StepGroup{
			Label: dbStepGroup.Label,
			Steps: make([]*frontendapi.RecipeStep, len(dbStepGroup.Steps)),
			Note:  dbStepGroup.Note,
		}
		for i, dbStep := range dbStepGroup.Steps {
			stepGroup.Steps[i] = &frontendapi.RecipeStep{
				Description: dbStep.Description,
				ImageUrl:    dbStep.ImageURL,
			}
		}
		plan.StepGroups[i] = stepGroup
	}
	plan.Notes = dbPlan.Notes

	stepsJSON, err := json.Marshal(plan.GetStepGroups())
	if err != nil {
		return nil, fmt.Errorf("getplan: marshalling plan: %w", err)
	}
	recipesJSON, err := json.Marshal(recipes)
	if err != nil {
		return nil, fmt.Errorf("getplan: marshalling recipes: %w", err)
	}
	prompt := ""
	if auth.IsCurioSwitchUser(ctx) {
		prompt = llm.PlanChatPrompt(ctx, string(stepsJSON), string(recipesJSON))
	}

	return &frontendapi.GetPlanResponse{Plan: plan, LlmPrompt: prompt}, nil
}
