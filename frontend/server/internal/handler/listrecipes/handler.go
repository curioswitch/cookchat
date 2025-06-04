package listrecipes

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	discoveryengine "cloud.google.com/go/discoveryengine/apiv1"
	"cloud.google.com/go/discoveryengine/apiv1/discoveryenginepb"
	"cloud.google.com/go/firestore"

	"github.com/curioswitch/cookchat/common/cookchatdb"
	frontendapi "github.com/curioswitch/cookchat/frontend/api/go"
)

func NewHandler(store *firestore.Client, search *discoveryengine.SearchClient, searchEngine string) *Handler {
	return &Handler{
		// store:        store,
		search:       search,
		searchEngine: searchEngine,
	}
}

type Handler struct {
	store        *firestore.Client
	search       *discoveryengine.SearchClient
	searchEngine string
}

func (h *Handler) ListRecipes(ctx context.Context, req *frontendapi.ListRecipesRequest) (*frontendapi.ListRecipesResponse, error) {
	// TODO: Consider only using search service even without query.
	if req.GetQuery() != "" {
		return h.searchRecipes(ctx, req)
	}

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
			ImageUrl: recipe.ImageURL,
		}
	}

	return &frontendapi.ListRecipesResponse{
		Recipes: snippets,
		Pagination: &frontendapi.Pagination{
			LastId: snippets[len(snippets)-1].GetId(),
		},
	}, nil
}

func (h *Handler) searchRecipes(ctx context.Context, req *frontendapi.ListRecipesRequest) (*frontendapi.ListRecipesResponse, error) {
	response := h.search.Search(ctx, &discoveryenginepb.SearchRequest{
		ServingConfig: h.searchEngine + "/servingConfigs/default_search",
		Query:         req.GetQuery(),
		QueryExpansionSpec: &discoveryenginepb.SearchRequest_QueryExpansionSpec{
			Condition: discoveryenginepb.SearchRequest_QueryExpansionSpec_AUTO,
		},
		PageSize:  5,
		PageToken: req.GetPagination().GetLastId(),
	})
	snippets := make([]*frontendapi.RecipeSnippet, 0, 5)
	for result, err := range response.All() {
		if err != nil {
			return nil, fmt.Errorf("listrecipes: searching recipes: %w", err)
		}
		data := result.GetDocument().GetStructData()
		if data == nil {
			slog.WarnContext(ctx, "listrecipes: search result has no struct data", "result", result)
			continue
		}
		id := data.GetFields()["id"].GetStringValue()
		title := data.GetFields()["title"].GetStringValue()
		imageURL := data.GetFields()["imageUrl"].GetStringValue()
		var summaryBuilder strings.Builder
		for _, ingredient := range data.GetFields()["ingredients"].GetListValue().GetValues() {
			name := ingredient.GetStructValue().GetFields()["name"].GetStringValue()
			summaryBuilder.WriteString(name)
			summaryBuilder.WriteString("・")
		}
		summary := summaryBuilder.String()
		if len(summary) > 0 {
			summary = summary[:len(summary)-len("・")]
		}
		snippets = append(snippets, &frontendapi.RecipeSnippet{
			Id:       id,
			Title:    title,
			Summary:  summary,
			ImageUrl: imageURL,
		})

		if response.PageInfo().Remaining() == 0 {
			break
		}
	}

	return &frontendapi.ListRecipesResponse{
		Recipes: snippets,
		Pagination: &frontendapi.Pagination{
			LastId: response.PageInfo().Token,
		},
	}, nil
}
