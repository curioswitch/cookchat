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
	"github.com/curioswitch/cookchat/common/planexec"
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

	recipes := make([]cookchatdb.Recipe, len(recipeDocs))
	content := make([]*genai.Content, len(recipeDocs))
	for i, doc := range recipeDocs {
		if err := doc.DataTo(&recipes[i]); err != nil {
			return plan, fmt.Errorf("updateplan: decoding recipe: %w", err)
		}
		recipeJSON, err := json.Marshal(planexec.RecipeInput{
			RecipeID: recipes[i].ID,
			Content:  recipes[i].Content,
		})
		if err != nil {
			return plan, fmt.Errorf("updateplan: marshalling recipe document to JSON: %w", err)
		}
		content[i] = genai.NewContentFromText(string(recipeJSON), genai.RoleUser)
	}

	res, err := h.genAI.Models.GenerateContent(ctx, "gemini-3.6-flash", content, &genai.GenerateContentConfig{
		SystemInstruction: genai.NewContentFromText(llm.GenerateExecutionPlanPrompt(), genai.RoleModel),
		ResponseMIMEType:  "application/json",
		ResponseSchema:    planexec.ResponseSchema(),
	})
	if err != nil {
		return plan, fmt.Errorf("updateplan: calling GenerateContent for execution plan: %w", err)
	}
	if len(res.Candidates) != 1 || len(res.Candidates[0].Content.Parts) != 1 || res.Candidates[0].Content.Parts[0].Text == "" {
		return plan, fmt.Errorf("updateplan: unexpected response from generate ai for execution plan: %v", res)
	}
	var generatedPlan planexec.GeneratedPlan
	if err := json.Unmarshal([]byte(res.Candidates[0].Content.Parts[0].Text), &generatedPlan); err != nil {
		return plan, fmt.Errorf("updateplan: failed to unmarshal received plan: %w", err)
	}
	stepGroups, err := planexec.ResolveStepGroups(generatedPlan.StepGroups, recipes)
	if err != nil {
		return plan, fmt.Errorf("updateplan: resolving generated step references: %w", err)
	}
	plan.StepGroups = stepGroups
	plan.Notes = generatedPlan.Notes
	return plan, nil
}
