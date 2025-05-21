package recipe

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"cloud.google.com/go/firestore"
	"github.com/gocolly/colly/v2"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/curioswitch/cookchat/common/cookchatdb"
	crawlerapi "github.com/curioswitch/cookchat/crawler/api/go"
)

var errMalformedID = errors.New("cookpad:recipe: malformed ID in existing recipe")

func NewHandler(baseCollector *colly.Collector, store *firestore.Client) *Handler {
	return &Handler{
		baseCollector: baseCollector,
		store:         store,
	}
}

type Handler struct {
	baseCollector *colly.Collector
	store         *firestore.Client
}

func (h *Handler) CrawlCookpadRecipe(ctx context.Context, req *crawlerapi.CrawlCookpadRecipeRequest) (*crawlerapi.CrawlCookpadRecipeResponse, error) {
	// Avoid clone since we don't want to share storage.
	c := colly.NewCollector(
		colly.UserAgent(h.baseCollector.UserAgent),
		colly.StdlibContext(ctx),
	)

	var recipe *cookchatdb.Recipe

	c.OnHTML("div[id=recipe]", func(e *colly.HTMLElement) {
		title := e.ChildText("h1")
		userID := strings.TrimPrefix(e.ChildAttr(`a[href^="/jp/users/"]`, "href"), "/jp/users/")
		description := e.ChildText("h1 ~ div:last-child")

		var recipeImage []byte
		recipeImageURL := e.ChildAttr("img", "src")
		if recipeImageURL != "" {
			// TODO: Log errors
			recipeImage, _ = fetchImage(ctx, recipeImageURL)
		}

		var baseIngredients []cookchatdb.RecipeIngredient

		var additionalSections []cookchatdb.IngredientSection
		var curSection *cookchatdb.IngredientSection
		curIngedients := &baseIngredients

		servingSize := e.ChildText("#serving_recipe_" + req.GetRecipeId())

		e.ForEach(".ingredient-list ol > li", func(_ int, e *colly.HTMLElement) {
			if strings.Contains(e.Attr("class"), "not-headline") {
				name := e.ChildText("*:first-child")
				quantity := e.ChildText("*:last-child")
				ingredient := cookchatdb.RecipeIngredient{
					Name:     name,
					Quantity: quantity,
				}
				*curIngedients = append(*curIngedients, ingredient)
			} else {
				if curSection != nil {
					additionalSections = append(additionalSections, *curSection)
				}
				curSection = &cookchatdb.IngredientSection{
					Title:       e.ChildText("*:first-child"),
					Ingredients: []cookchatdb.RecipeIngredient{},
				}
				curIngedients = &curSection.Ingredients
			}
		})
		if curSection != nil {
			additionalSections = append(additionalSections, *curSection)
		}

		var steps []cookchatdb.RecipeStep
		e.ForEach("#steps ol > li", func(_ int, e *colly.HTMLElement) {
			step := strings.TrimSpace(e.DOM.Children().Last().Text())
			imageURL := e.ChildAttr("img", "src")
			var image []byte
			if imageURL != "" {
				// TODO: Log errors
				image, _ = fetchImage(ctx, imageURL)
			}
			steps = append(steps, cookchatdb.RecipeStep{
				Description: step,
				Image:       image,
			})
		})

		recipe = &cookchatdb.Recipe{
			Source:                cookchatdb.RecipeSourceCookpad,
			SourceID:              req.GetRecipeId(),
			UserID:                userID,
			Title:                 title,
			Image:                 recipeImage,
			Description:           description,
			Ingredients:           baseIngredients,
			AdditionalIngredients: additionalSections,
			Steps:                 steps,
			ServingSize:           servingSize,
			LanguageCode:          "ja",
		}
	})

	if err := c.Visit("https://cookpad.com/jp/recipes/" + req.GetRecipeId()); err != nil {
		return nil, fmt.Errorf("cookpad:recipe: failed to scrape page: %w", err)
	}

	recipes := h.store.Collection("recipes")
	// Follow firestore conventions for IDs, though we don't use it in the actual document ID.
	recipe.ID = recipes.NewDoc().ID
	doc := recipes.Doc("cookpad-" + recipe.SourceID)
	if _, err := doc.Create(ctx, recipe); err != nil {
		if status.Code(err) != codes.AlreadyExists {
			return nil, fmt.Errorf("cookpad:recipe: failed to create recipe: %w", err)
		}
		existing, err := doc.Get(ctx)
		if err != nil {
			return nil, fmt.Errorf("cookpad:recipe: failed to get existing recipe: %w", err)
		}
		// TODO: We can save an RPC by using a merge instead of fetching, but it's tedious since
		// it doesn't support structs.
		id, ok := existing.Data()["id"].(string)
		if !ok {
			return nil, errMalformedID
		}
		recipe.ID = id
		if _, err := doc.Set(ctx, recipe); err != nil {
			return nil, fmt.Errorf("cookpad:recipe: failed to update recipe: %w", err)
		}
	}

	return &crawlerapi.CrawlCookpadRecipeResponse{}, nil
}

func fetchImage(ctx context.Context, imageURL string) ([]byte, error) {
	imageReq, _ := http.NewRequestWithContext(ctx, http.MethodGet, imageURL, nil)
	res, err := http.DefaultClient.Do(imageReq)
	if err != nil {
		return nil, fmt.Errorf("cookpad:recipe: failed to fetch image: %w", err)
	}
	defer func() {
		_ = res.Body.Close()
	}()
	image, err := io.ReadAll(res.Body)
	if err != nil {
		return nil, fmt.Errorf("cookpad:recipe: failed to read image body: %w", err)
	}
	return image, nil
}
