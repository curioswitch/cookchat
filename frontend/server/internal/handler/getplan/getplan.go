// Copyright (c) CurioSwitch (choko@curioswitch.org)
// SPDX-License-Identifier: BUSL-1.1

package getplan

import (
	"context"
	"errors"
	"fmt"
	"time"

	"cloud.google.com/go/firestore"
	"github.com/curioswitch/go-usegcp/middleware/firebaseauth"
	"google.golang.org/api/iterator"
	"google.golang.org/protobuf/types/known/timestamppb"

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

func (h *Handler) GetPlan(ctx context.Context, req *frontendapi.GetPlanRequest) (*frontendapi.GetPlanResponse, error) {
	userID := firebaseauth.TokenFromContext(ctx).UID

	col := h.store.Collection("users").Doc(userID).Collection("plans")
	doc, err := col.Doc(req.GetDate().AsTime().Format(time.DateOnly)).Get(ctx)
	if err != nil {
		return nil, fmt.Errorf("getplan: fetching plan: %w", err)
	}

	var dbPlan cookchatdb.Plan
	if err := doc.DataTo(&dbPlan); err != nil {
		return nil, fmt.Errorf("getplans: decoding plan: %w", err)
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
			return nil, fmt.Errorf("getplans: fetching recipe: %w", err)
		}
		var recipe cookchatdb.Recipe
		if err := doc.DataTo(&recipe); err != nil {
			return nil, fmt.Errorf("getplans: decoding recipe: %w", err)
		}
		recipes = append(recipes, recipe)
	}

	plan := &frontendapi.Plan{
		Date:       timestamppb.New(dbPlan.Date),
		Recipes:    make([]*frontendapi.RecipeSnippet, len(recipes)),
		StepGroups: make([]*frontendapi.StepGroup, len(dbPlan.StepGroups)),
	}
	for i, recipe := range recipes {
		plan.Recipes[i] = &frontendapi.RecipeSnippet{
			Id:       recipe.ID,
			Title:    recipe.Title,
			Summary:  recipe.Description,
			ImageUrl: recipe.ImageURL,
		}
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

	return &frontendapi.GetPlanResponse{Plan: plan}, nil
}
