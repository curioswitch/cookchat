// Copyright (c) CurioSwitch (choko@curioswitch.org)
// SPDX-License-Identifier: BUSL-1.1

package getplans

import (
	"context"
	"errors"
	"fmt"
	"time"

	"cloud.google.com/go/firestore"
	"github.com/curioswitch/go-usegcp/middleware/firebaseauth"
	"google.golang.org/api/iterator"

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

func (h *Handler) GetPlans(ctx context.Context, _ *frontendapi.GetPlansRequest) (*frontendapi.GetPlansResponse, error) {
	now := time.Now()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)

	userID := firebaseauth.TokenFromContext(ctx).UID

	plansCol := h.store.Collection("users").Doc(userID).Collection("plans")
	iter := plansCol.Query.WhereEntity(firestore.PropertyFilter{
		Path:     "createdAt",
		Operator: ">=",
		Value:    today,
	}).Limit(5).Documents(ctx)
	defer iter.Stop()

	var dbPlans []cookchatdb.Plan
	var recipeIDs []string
	for {
		doc, err := iter.Next()
		if errors.Is(err, iterator.Done) {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("getplans: fetching plan: %w", err)
		}

		var plan cookchatdb.Plan
		if err := doc.DataTo(&plan); err != nil {
			return nil, fmt.Errorf("getplans: decoding plan: %w", err)
		}
		dbPlans = append(dbPlans, plan)
		recipeIDs = append(recipeIDs, plan.Recipes...)
	}
	recipes := map[string]cookchatdb.Recipe{}

	if len(recipeIDs) > 0 {
		recipesCol := h.store.Collection("recipes")
		iter = recipesCol.Query.WhereEntity(firestore.PropertyFilter{
			Path:     "id",
			Operator: "in",
			Value:    recipeIDs,
		}).Documents(ctx)
		defer iter.Stop()

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
			recipes[recipe.ID] = recipe
		}
	}

	plans := make([]*frontendapi.PlanSnippet, len(dbPlans))
	for i, dbPlan := range dbPlans {
		plan := &frontendapi.PlanSnippet{
			Id: dbPlan.ID,
		}
		for _, recipeID := range dbPlan.Recipes {
			if recipe, ok := recipes[recipeID]; ok {
				plan.Recipes = append(plan.Recipes, &frontendapi.RecipeSnippet{
					Id:       recipe.ID,
					Title:    recipe.Content.Title,
					Summary:  recipe.Content.Description,
					ImageUrl: recipe.ImageURL,
				})
			} else {
				return nil, fmt.Errorf("getplans: recipe %s not found for plan %s", recipeID, dbPlan.ID)
			}
		}
		plans[i] = plan
	}

	return &frontendapi.GetPlansResponse{Plans: plans}, nil
}
