// Copyright (c) CurioSwitch (choko@curioswitch.org)
// SPDX-License-Identifier: BUSL-1.1

package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"google.golang.org/genai"

	"github.com/curioswitch/cookchat/common/cookchatdb"
)

func TestEmbeddedRecipes(t *testing.T) {
	var recipes []sourceRecipe
	if err := json.Unmarshal(recipesJSON, &recipes); err != nil {
		t.Fatalf("json.Unmarshal(recipesJSON): %v", err)
	}
	if got, want := len(recipes), 232; got != want {
		t.Fatalf("recipe count = %d, want %d", got, want)
	}
	if err := validate(recipes); err != nil {
		t.Fatalf("validate(recipes): %v", err)
	}

	sourceIDs := make(map[string]bool, len(recipes))
	for _, recipe := range recipes {
		sourceIDs[recipe.SourceID] = true
		if recipe.Content.Notes != "" {
			t.Errorf("recipe %q contains source commentary", recipe.SourceID)
		}
	}
	for _, sourceID := range []string{
		"akita-breakfast-3-2",
		"akita-breakfast-6-2",
		"kochi-dinner-7-2",
		"kochi-lunch-6-2",
	} {
		if !sourceIDs[sourceID] {
			t.Errorf("merged recipe %q is missing", sourceID)
		}
	}
}

func TestValidateRejectsRecipeWithoutPrimaryIngredients(t *testing.T) {
	recipes := []sourceRecipe{{
		SourceID: "test",
		Content: cookchatdb.RecipeContent{
			SourceURL: "https://example.com/recipe",
			Title:     "test",
			Steps:     []cookchatdb.RecipeStep{{Description: "test"}},
		},
	}}
	if err := validate(recipes); err == nil {
		t.Fatal("validate(recipes) succeeded, want an error")
	}
}

func TestRecipesToImport(t *testing.T) {
	recipes := []sourceRecipe{{SourceID: "one"}, {SourceID: "two"}, {SourceID: "three"}}
	got, err := recipesToImport(recipes, "two")
	if err != nil {
		t.Fatalf("recipesToImport: %v", err)
	}
	if len(got) != 2 || got[0].SourceID != "two" {
		t.Fatalf("recipesToImport = %#v, want recipes starting at two", got)
	}
	if _, err := recipesToImport(recipes, "missing"); err == nil {
		t.Fatal("recipesToImport with unknown source ID succeeded, want an error")
	}
}

func TestIsRetryable(t *testing.T) {
	if !isRetryable(fmt.Errorf("wrapped: %w", genai.APIError{Code: http.StatusTooManyRequests})) {
		t.Error("429 API error is not retryable")
	}
	if isRetryable(genai.APIError{Code: http.StatusBadRequest}) {
		t.Error("400 API error is retryable")
	}
}
