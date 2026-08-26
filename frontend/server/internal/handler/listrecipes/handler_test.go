// Copyright (c) CurioSwitch (choko@curioswitch.org)
// SPDX-License-Identifier: BUSL-1.1

package listrecipes

import (
	"fmt"
	"testing"

	frontendapi "github.com/curioswitch/cookchat/frontend/api/go"
)

func TestSplitRecommendations(t *testing.T) {
	snippets := make([]*frontendapi.RecipeSnippet, 10)
	for i := range snippets {
		snippets[i] = &frontendapi.RecipeSnippet{Id: fmt.Sprintf("recipe-%02d", i)}
	}

	recipes, recommendations := splitRecommendations(snippets, 4)
	if got, want := len(recipes), 6; got != want {
		t.Fatalf("len(recipes) = %d, want %d", got, want)
	}
	if got, want := len(recommendations), 4; got != want {
		t.Fatalf("len(recommendations) = %d, want %d", got, want)
	}

	seen := make(map[string]bool, len(snippets))
	for _, recipe := range recommendations {
		if seen[recipe.GetId()] {
			t.Fatalf("duplicate recommendation %q", recipe.GetId())
		}
		seen[recipe.GetId()] = true
	}

	lastRecipeID := ""
	for _, recipe := range recipes {
		if seen[recipe.GetId()] {
			t.Fatalf("recipe %q was also recommended", recipe.GetId())
		}
		if recipe.GetId() < lastRecipeID {
			t.Fatalf("recipes are not in source order: %q before %q", lastRecipeID, recipe.GetId())
		}
		lastRecipeID = recipe.GetId()
		seen[recipe.GetId()] = true
	}

	if got, want := len(seen), len(snippets); got != want {
		t.Fatalf("partition contained %d recipes, want %d", got, want)
	}
}

func TestSplitRecommendationsUsesAllAvailableRecipes(t *testing.T) {
	snippets := []*frontendapi.RecipeSnippet{
		{Id: "one"},
		{Id: "two"},
	}

	recipes, recommendations := splitRecommendations(snippets, 4)
	if len(recipes) != 0 {
		t.Fatalf("len(recipes) = %d, want 0", len(recipes))
	}
	if got, want := len(recommendations), len(snippets); got != want {
		t.Fatalf("len(recommendations) = %d, want %d", got, want)
	}
}
