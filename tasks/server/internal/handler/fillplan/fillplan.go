// Copyright (c) CurioSwitch (choko@curioswitch.org)
// SPDX-License-Identifier: BUSL-1.1

package fillplan

import (
	"context"
	"encoding/json"
	"fmt"

	firestore "cloud.google.com/go/firestore"
	"github.com/curioswitch/go-usegcp/middleware/firebaseauth"
	"golang.org/x/sync/errgroup"
	"google.golang.org/genai"

	"github.com/curioswitch/cookchat/common/cookchatdb"
	"github.com/curioswitch/cookchat/common/planexec"
	"github.com/curioswitch/cookchat/common/recipegen"
	tasksapi "github.com/curioswitch/cookchat/tasks/api/go"
	"github.com/curioswitch/cookchat/tasks/server/internal/llm"
)

func NewHandler(store *firestore.Client, genAI *genai.Client, processor *recipegen.PostProcessor) *Handler {
	return &Handler{
		store:     store,
		genAI:     genAI,
		processor: processor,
	}
}

type Handler struct {
	store     *firestore.Client
	genAI     *genai.Client
	processor *recipegen.PostProcessor
}

func (h *Handler) FillPlan(ctx context.Context, req *tasksapi.FillPlanRequest) (*tasksapi.FillPlanResponse, error) {
	userID := firebaseauth.TokenFromContext(ctx).UID

	plansCol := h.store.Collection("users").Doc(userID).Collection("plans")
	planDoc, err := plansCol.Doc(req.GetPlanId()).Get(ctx)
	if err != nil {
		return nil, fmt.Errorf("fillplan: getting plan doc: %w", err)
	}

	var plan cookchatdb.Plan
	if err := planDoc.DataTo(&plan); err != nil {
		return nil, fmt.Errorf("fillplan: parsing plan doc: %w", err)
	}

	var grp errgroup.Group

	recipesCol := h.store.Collection("recipes")
	recipes := make([]cookchatdb.Recipe, len(plan.Recipes))
	for i, recipeID := range plan.Recipes {
		grp.Go(func() error {
			recipeDoc, err := recipesCol.Query.Where("id", "==", recipeID).Limit(1).Documents(ctx).Next()
			if err != nil {
				return fmt.Errorf("fillplan: getting recipe doc: %w", err)
			}
			var recipe cookchatdb.Recipe
			if err := recipeDoc.DataTo(&recipe); err != nil {
				return fmt.Errorf("fillplan: parsing recipe doc: %w", err)
			}
			if err := h.processor.PostProcessRecipe(ctx, &recipe); err != nil {
				return fmt.Errorf("fillplan: post processing recipe: %w", err)
			}
			recipe.Status = cookchatdb.RecipeStatusActive
			if _, err := recipeDoc.Ref.Set(ctx, recipe); err != nil {
				return fmt.Errorf("fillplan: updating recipe doc: %w", err)
			}
			recipes[i] = recipe
			return nil
		})
	}
	if err := grp.Wait(); err != nil {
		return nil, err
	}

	content := make([]*genai.Content, len(recipes))
	for i, recipe := range recipes {
		recipeJSON, err := json.Marshal(planexec.RecipeInput{
			RecipeID: recipe.ID,
			Content:  recipe.Content,
		})
		if err != nil {
			return nil, fmt.Errorf("fillplan: marshaling recipe content: %w", err)
		}
		content[i] = genai.NewContentFromText(string(recipeJSON), genai.RoleUser)
	}

	res, err := h.genAI.Models.GenerateContent(ctx, "gemini-3.6-flash", content, &genai.GenerateContentConfig{
		SystemInstruction: genai.NewContentFromText(llm.GenerateExecutionPlanPrompt(), genai.RoleModel),
		ResponseMIMEType:  "application/json",
		ResponseSchema:    planexec.ResponseSchema(),
	})
	if err != nil {
		return nil, fmt.Errorf("fillplan: generating execution plan: %w", err)
	}
	if len(res.Candidates) != 1 || len(res.Candidates[0].Content.Parts) != 1 || res.Candidates[0].Content.Parts[0].Text == "" {
		return nil, fmt.Errorf("fillplan: unexpected generation result: %v", res)
	}

	var generatedPlan planexec.GeneratedPlan
	if err := json.Unmarshal([]byte(res.Candidates[0].Content.Parts[0].Text), &generatedPlan); err != nil {
		return nil, fmt.Errorf("fillplan: parsing generation result: %w", err)
	}
	stepGroups, err := planexec.ResolveStepGroups(generatedPlan.StepGroups, recipes)
	if err != nil {
		return nil, fmt.Errorf("fillplan: resolving generated step references: %w", err)
	}
	plan.StepGroups = stepGroups
	plan.Notes = generatedPlan.Notes
	plan.Status = cookchatdb.PlanStatusActive
	if _, err := planDoc.Ref.Set(ctx, plan); err != nil {
		return nil, fmt.Errorf("fillplan: updating plan doc: %w", err)
	}

	return &tasksapi.FillPlanResponse{}, nil
}
