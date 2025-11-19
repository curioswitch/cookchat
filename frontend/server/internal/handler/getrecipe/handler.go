// Copyright (c) CurioSwitch (choko@curioswitch.org)
// SPDX-License-Identifier: BUSL-1.1

package getrecipe

import (
	"context"
	"errors"
	"fmt"

	"cloud.google.com/go/firestore"
	"connectrpc.com/connect"
	"github.com/curioswitch/go-usegcp/middleware/firebaseauth"
	"google.golang.org/api/iterator"

	"github.com/curioswitch/cookchat/common/cookchatdb"
	frontendapi "github.com/curioswitch/cookchat/frontend/api/go"
	"github.com/curioswitch/cookchat/frontend/server/internal/auth"
	"github.com/curioswitch/cookchat/frontend/server/internal/i18n"
	"github.com/curioswitch/cookchat/frontend/server/internal/llm"
)

var errRecipeNotFound = errors.New("recipe not found")

func NewHandler(store *firestore.Client) *Handler {
	return &Handler{
		store: store,
	}
}

type Handler struct {
	store *firestore.Client
}

func (h *Handler) GetRecipe(ctx context.Context, req *frontendapi.GetRecipeRequest) (*frontendapi.GetRecipeResponse, error) {
	doc, err := h.store.Collection("recipes").Where("id", "==", req.GetRecipeId()).Limit(1).Documents(ctx).Next()
	if err != nil {
		if errors.Is(err, iterator.Done) {
			return nil, connect.NewError(connect.CodeNotFound, errRecipeNotFound)
		}
		return nil, fmt.Errorf("getrecipe: getting recipe from firestore: %w", err)
	}

	var recipe cookchatdb.Recipe
	if err := doc.DataTo(&recipe); err != nil {
		return nil, fmt.Errorf("getrecipe: unmarshalling recipe: %w", err)
	}

	bookmarked := false
	if doc, _ := h.store.Collection("users").
		Doc(firebaseauth.TokenFromContext(ctx).UID).
		Collection("bookmarks").Doc("recipe-" + req.GetRecipeId()).Get(ctx); doc != nil && doc.Exists() {
		bookmarked = true
	}

	prompt := ""
	if auth.IsCurioSwitchUser(ctx) {
		prompt = llm.RecipeChatPrompt(ctx)
	}
	return &frontendapi.GetRecipeResponse{
		Recipe:       recipeToProto(&recipe, i18n.UserLanguage(ctx)),
		LlmPrompt:    prompt,
		IsBookmarked: bookmarked,
	}, nil
}

func recipeToProto(recipe *cookchatdb.Recipe, lng string) *frontendapi.Recipe {
	res := &frontendapi.Recipe{
		Id:       recipe.ID,
		Source:   recipeSourceToProto(recipe.Source),
		ImageUrl: recipe.ImageURL,
		Language: languageCodeToProto(recipe.LanguageCode),
	}

	if rlng, rlc := recipe.LanguageCode, recipe.LocalizedContent[lng]; rlng != lng && rlc != nil {
		res.Title = rlc.Title
		res.Description = rlc.Description
		res.Ingredients = ingredientsToProto(rlc.Ingredients)
		res.AdditionalIngredients = ingredientSectionsToProto(rlc.AdditionalIngredients)
		res.Steps = stepsToProto(rlc.Steps)
		for i, step := range res.GetSteps() {
			step.ImageUrl = recipe.Steps[i].ImageURL
		}
		res.Notes = rlc.Notes
		res.ServingSize = rlc.ServingSize
	} else {
		res.Title = recipe.Title
		res.Description = recipe.Description
		res.Ingredients = ingredientsToProto(recipe.Ingredients)
		res.AdditionalIngredients = ingredientSectionsToProto(recipe.AdditionalIngredients)
		res.Steps = stepsToProto(recipe.Steps)
		res.Notes = recipe.Notes
		res.ServingSize = recipe.ServingSize
	}

	return res
}

func recipeSourceToProto(src cookchatdb.RecipeSource) frontendapi.RecipeSource {
	switch src {
	case cookchatdb.RecipeSourceCookpad:
		return frontendapi.RecipeSource_RECIPE_SOURCE_COOKPAD
	case cookchatdb.RecipeSourceOrangePage:
		return frontendapi.RecipeSource_RECIPE_SOURCE_ORANGE_PAGE
	case cookchatdb.RecipeSourceDelishKitchen:
		return frontendapi.RecipeSource_RECIPE_SOURCE_DELISH_KITCHEN
	case cookchatdb.RecipeSourceUser, cookchatdb.RecipeSourceAI:
		fallthrough
	default:
		return frontendapi.RecipeSource_RECIPE_SOURCE_UNSPECIFIED
	}
}

func ingredientsToProto(ings []cookchatdb.RecipeIngredient) []*frontendapi.RecipeIngredient {
	result := make([]*frontendapi.RecipeIngredient, len(ings))
	for i, ing := range ings {
		result[i] = &frontendapi.RecipeIngredient{
			Name:     ing.Name,
			Quantity: ing.Quantity,
		}
	}
	return result
}

func stepsToProto(steps []cookchatdb.RecipeStep) []*frontendapi.RecipeStep {
	result := make([]*frontendapi.RecipeStep, len(steps))
	for i, step := range steps {
		result[i] = &frontendapi.RecipeStep{
			Description: step.Description,
			ImageUrl:    step.ImageURL,
		}
	}
	return result
}

func ingredientSectionsToProto(sections []cookchatdb.IngredientSection) []*frontendapi.IngredientSection {
	result := make([]*frontendapi.IngredientSection, len(sections))
	for i, sec := range sections {
		result[i] = &frontendapi.IngredientSection{
			Title:       sec.Title,
			Ingredients: ingredientsToProto(sec.Ingredients),
		}
	}
	return result
}

func languageCodeToProto(code string) frontendapi.Language {
	switch code {
	case "en":
		return frontendapi.Language_LANGUAGE_ENGLISH
	case "ja":
		return frontendapi.Language_LANGUAGE_JAPANESE
	default:
		return frontendapi.Language_LANGUAGE_UNSPECIFIED
	}
}
