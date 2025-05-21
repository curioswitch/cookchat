package recipe

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"cloud.google.com/go/firestore"
	"cloud.google.com/go/storage"
	"github.com/gocolly/colly/v2"
	"github.com/wandb/parallel"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/curioswitch/cookchat/common/cookchatdb"
	crawlerapi "github.com/curioswitch/cookchat/crawler/api/go"
)

var errMalformedID = errors.New("cookpad:recipe: malformed ID in existing recipe")

func NewHandler(baseCollector *colly.Collector, store *firestore.Client, storage *storage.Client, publicBucket string) *Handler {
	return &Handler{
		baseCollector: baseCollector,
		store:         store,
		storage:       storage,
		publicBucket:  publicBucket,
	}
}

type Handler struct {
	baseCollector *colly.Collector
	store         *firestore.Client
	storage       *storage.Client
	publicBucket  string
}

func (h *Handler) CrawlCookpadRecipe(ctx context.Context, req *crawlerapi.CrawlCookpadRecipeRequest) (*crawlerapi.CrawlCookpadRecipeResponse, error) {
	// Avoid clone since we don't want to share storage.
	c := colly.NewCollector(
		colly.UserAgent(h.baseCollector.UserAgent),
		colly.StdlibContext(ctx),
	)

	var recipe *cookchatdb.Recipe

	recipes := h.store.Collection("recipes")
	recipeID := recipes.NewDoc().ID

	c.OnHTML("div[id=recipe]", func(e *colly.HTMLElement) {
		title := e.ChildText("h1")
		userID := strings.TrimPrefix(e.ChildAttr(`a[href^="/jp/users/"]`, "href"), "/jp/users/")
		description := e.ChildText("h1 ~ div:last-child")

		recipeImageFetchURL := e.ChildAttr("img", "src")
		recipeImageURL := ""
		if recipeImageFetchURL != "" {
			// TODO: Log errors
			recipeImage, _ := fetchImage(ctx, recipeImageFetchURL)
			path := fmt.Sprintf("recipes/%s/main-image.jpg", recipeID)
			if err := h.saveFile(ctx, path, recipeImage); err != nil {
				// TODO: Log errors
				return
			}
			recipeImageURL = fmt.Sprintf("https://storage.googleapis.com/%s/%s", h.publicBucket, path)
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

		grp := parallel.CollectWithErrs[cookchatdb.RecipeStep](parallel.Unlimited(ctx))
		e.ForEach("#steps ol > li", func(i int, e *colly.HTMLElement) {
			grp.Go(func(ctx context.Context) (cookchatdb.RecipeStep, error) {
				step := strings.TrimSpace(e.DOM.Children().Last().Text())
				imageFetchURL := e.ChildAttr("img", "src")
				stepImageURL := ""
				if imageFetchURL != "" {
					image, err := fetchImage(ctx, imageFetchURL)
					// TODO: Log errors
					if err != nil {
						return cookchatdb.RecipeStep{}, fmt.Errorf("cookpad:recipe: fetch step image: %w", err)
					}
					path := fmt.Sprintf("recipes/%s/step-%03d.jpg", recipeID, i)
					if err := h.saveFile(ctx, path, image); err != nil {
						return cookchatdb.RecipeStep{}, fmt.Errorf("cookpad:recipe: save step image: %w", err)
					}
					stepImageURL = fmt.Sprintf("https://storage.googleapis.com/%s/%s", h.publicBucket, path)
				}
				return cookchatdb.RecipeStep{
					Description: step,
					ImageURL:    stepImageURL,
				}, nil
			})
		})
		steps, err := grp.Wait()
		if err != nil {
			// TODO: Log errors
			return
		}

		recipe = &cookchatdb.Recipe{
			Source:                cookchatdb.RecipeSourceCookpad,
			SourceID:              req.GetRecipeId(),
			UserID:                userID,
			Title:                 title,
			ImageURL:              recipeImageURL,
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

func (h *Handler) saveFile(ctx context.Context, path string, contents []byte) error {
	w := h.storage.Bucket(h.publicBucket).Object(path).NewWriter(ctx)
	defer func() {
		// TODO: Log error
		_ = w.Close()
	}()
	w.ContentType = "image/jpeg"
	if _, err := w.Write(contents); err != nil {
		return fmt.Errorf("cookpad:recipe: save image: %w", err)
	}
	return nil
}

func fetchImage(ctx context.Context, imageURL string) ([]byte, error) {
	if base, ok := imageURLBase(imageURL); ok {
		imageURL = base + "/640x640sq70/photo.jpg"
	}

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

func imageURLBase(imageURL string) (string, bool) {
	if !strings.HasPrefix(imageURL, "https://img-global-jp.cpcdn.com/") {
		return imageURL, false
	}

	slashIdx := strings.LastIndexByte(imageURL, '/')
	if slashIdx == -1 {
		return imageURL, false
	}

	imageURL = imageURL[:slashIdx]
	slashIdx = strings.LastIndexByte(imageURL, '/')
	if slashIdx == -1 {
		return imageURL, false
	}
	return imageURL[:slashIdx], true
}
