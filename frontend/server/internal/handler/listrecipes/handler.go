package listrecipes

import (
	"context"
	"encoding/base64"
	"fmt"

	"cloud.google.com/go/firestore"
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

func (h *Handler) ListRecipes(ctx context.Context, req *frontendapi.ListRecipesRequest) (*frontendapi.ListRecipesResponse, error) {
	q := h.store.Collection("recipes").Query
	if p := req.GetPagination(); p != nil {
		q = q.Where("id", ">", p.GetLastId())
	}
	q = q.OrderBy("id", firestore.Asc).Limit(5)
	recipeDocs, err := q.Documents(ctx).GetAll()
	if err != nil {
		return nil, fmt.Errorf("listrecipes: getting recipes from firestore: %w", err)
	}
	if len(recipeDocs) == 0 {
		return &frontendapi.ListRecipesResponse{}, nil
	}

	snippets := make([]*frontendapi.RecipeSnippet, len(recipeDocs))
	for i, doc := range recipeDocs {
		var recipe cookchatdb.Recipe
		if err := doc.DataTo(&recipe); err != nil {
			return nil, fmt.Errorf("listrecipes: unmarshalling recipe: %w", err)
		}

		imageURL := ""
		if recipe.Image != nil {
			imageURL = "data:image/jpeg;base64," + base64.StdEncoding.EncodeToString(recipe.Image)
		}

		summary := ""
		for _, ingredient := range recipe.Ingredients {
			summary += ingredient.Name + "・"
		}
		if len(summary) > 0 {
			summary = summary[:len(summary)-len("・")]
		}

		snippets[i] = &frontendapi.RecipeSnippet{
			Id:       recipe.ID,
			Title:    recipe.Title,
			Summary:  summary,
			ImageUrl: imageURL,
		}
	}

	return &frontendapi.ListRecipesResponse{
		Recipes: snippets,
		Pagination: &frontendapi.Pagination{
			LastId: snippets[len(snippets)-1].GetId(),
		},
	}, nil
}
