// Copyright (c) CurioSwitch (choko@curioswitch.org)
// SPDX-License-Identifier: BUSL-1.1

package listrecipes

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"time"

	discoveryengine "cloud.google.com/go/discoveryengine/apiv1"
	"cloud.google.com/go/discoveryengine/apiv1/discoveryenginepb"
	"cloud.google.com/go/firestore"
	"github.com/curioswitch/go-usegcp/middleware/firebaseauth"

	"github.com/curioswitch/cookchat/common/cookchatdb"
	frontendapi "github.com/curioswitch/cookchat/frontend/api/go"
	"github.com/curioswitch/cookchat/frontend/server/internal/i18n"
)

func NewHandler(store *firestore.Client, search *discoveryengine.SearchClient, searchEngine string) *Handler {
	return &Handler{
		store:        store,
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

	var recipeDocs []*firestore.DocumentSnapshot
	var lastBookmark time.Time

	if req.GetBookmarks() {
		q := h.store.Collection("users").Doc(firebaseauth.TokenFromContext(ctx).UID).Collection("bookmarks").Query
		if lts := req.GetPagination().GetLastTimestampNanos(); lts != 0 {
			ts := time.Unix(0, lts)
			q = q.Where("createdAt", "<", ts)
		}
		q = q.OrderBy("createdAt", firestore.Desc).Limit(5)
		bookmarkDocs, err := q.Documents(ctx).GetAll()
		if err != nil {
			return nil, fmt.Errorf("listrecipes: getting bookmarks from firestore: %w", err)
		}
		if len(bookmarkDocs) == 0 {
			return &frontendapi.ListRecipesResponse{}, nil
		}

		recipeIDs := make([]string, 0, len(bookmarkDocs))
		for _, doc := range bookmarkDocs {
			var bookmark cookchatdb.RecipeBookmark
			if err := doc.DataTo(&bookmark); err != nil {
				return nil, fmt.Errorf("listrecipes: unmarshalling bookmark: %w", err)
			}
			recipeIDs = append(recipeIDs, bookmark.RecipeID)
			lastBookmark = bookmark.CreatedAt
		}

		nonUserDocs, err := h.store.Collection("recipes").Query.Where("id", "in", recipeIDs).Documents(ctx).GetAll()
		if err != nil {
			return nil, fmt.Errorf("listrecipes: getting bookmarked recipes from firestore: %w", err)
		}
		recipeDocs = append(recipeDocs, nonUserDocs...)
	} else {
		q := h.store.Collection("recipes").Query
		q = q.Where("source", "!=", cookchatdb.RecipeSourceUser)
		if lid := req.GetPagination().GetLastId(); lid != "" {
			q = q.Where("id", ">", lid)
		}
		q = q.OrderBy("id", firestore.Asc).Limit(5)
		nonUserDocs, err := q.Documents(ctx).GetAll()
		if err != nil {
			return nil, fmt.Errorf("listrecipes: getting recipes from firestore: %w", err)
		}
		recipeDocs = append(recipeDocs, nonUserDocs...)
	}

	if len(recipeDocs) == 0 {
		return &frontendapi.ListRecipesResponse{}, nil
	}

	lng := i18n.UserLanguage(ctx)

	snippets := make([]*frontendapi.RecipeSnippet, len(recipeDocs))
	for i, doc := range recipeDocs {
		var recipe cookchatdb.Recipe
		if err := doc.DataTo(&recipe); err != nil {
			return nil, fmt.Errorf("listrecipes: unmarshalling recipe: %w", err)
		}

		title := recipe.Title
		ingredients := recipe.Ingredients
		if rlng, rlc := recipe.LanguageCode, recipe.LocalizedContent[lng]; rlng != lng && rlc != nil {
			title = rlc.Title
			ingredients = rlc.Ingredients
		}

		var summaryBldr strings.Builder
		for _, ingredient := range ingredients {
			summaryBldr.WriteString(ingredient.Name)
			summaryBldr.WriteString("・")
		}
		summary := summaryBldr.String()
		if len(summary) > 0 {
			summary = summary[:len(summary)-len("・")]
		}

		snippets[i] = &frontendapi.RecipeSnippet{
			Id:       recipe.ID,
			Title:    title,
			Summary:  summary,
			ImageUrl: recipe.ImageURL,
		}
	}

	token := &frontendapi.Pagination{}
	if req.GetBookmarks() && !lastBookmark.IsZero() {
		token.LastTimestampNanos = lastBookmark.UnixNano()
	} else {
		token.LastId = snippets[len(snippets)-1].GetId()
	}

	return &frontendapi.ListRecipesResponse{
		Recipes:    snippets,
		Pagination: token,
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
