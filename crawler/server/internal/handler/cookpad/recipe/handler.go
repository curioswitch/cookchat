package recipe

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"cloud.google.com/go/firestore"
	"cloud.google.com/go/storage"
	"github.com/gocolly/colly/v2"
	"github.com/wandb/parallel"
	"google.golang.org/genai"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/curioswitch/cookchat/common/cookchatdb"
	crawlerapi "github.com/curioswitch/cookchat/crawler/api/go"
)

var errMalformedID = errors.New("cookpad:recipe: malformed ID in existing recipe")

func NewHandler(baseCollector *colly.Collector, store *firestore.Client, storage *storage.Client, genAI *genai.Client, publicBucket string) *Handler {
	return &Handler{
		baseCollector: baseCollector,
		store:         store,
		storage:       storage,
		genAI:         genAI,
		publicBucket:  publicBucket,
	}
}

type Handler struct {
	baseCollector *colly.Collector
	store         *firestore.Client
	storage       *storage.Client
	genAI         *genai.Client // Not used in this handler, but included for consistency.
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
	doc := recipes.Doc("cookpad-" + req.GetRecipeId())
	existing, err := doc.Get(ctx)
	if err != nil && status.Code(err) != codes.NotFound {
		return nil, fmt.Errorf("cookpad:recipe: failed to get existing recipe: %w", err)
	}
	if existing.Exists() {
		var recipe *cookchatdb.Recipe
		if err := existing.DataTo(&recipe); err != nil {
			return nil, fmt.Errorf("cookpad:recipe: failed to unmarshal existing recipe: %w", err)
		}
		if err := h.postProcessRecipe(ctx, recipe); err != nil {
			return nil, err
		}
		if _, err := doc.Set(ctx, recipe); err != nil {
			return nil, fmt.Errorf("cookpad:recipe: failed to update existing recipe: %w", err)
		}
		return &crawlerapi.CrawlCookpadRecipeResponse{}, nil
	}

	// Follow firestore conventions for IDs, though we don't use it in the actual document ID.
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

		grp := parallel.GatherErrs(parallel.Unlimited(ctx))
		stepNodes := e.DOM.Find("#steps ol > li")
		steps := make([]cookchatdb.RecipeStep, stepNodes.Length())
		for i, node := range stepNodes.EachIter() {
			grp.Go(func(ctx context.Context) error {
				step := strings.TrimSpace(node.Children().Last().Text())
				stepImageURL := ""
				if imageFetchURL, ok := node.Find("img").Attr("src"); ok {
					image, err := fetchImage(ctx, imageFetchURL)
					// TODO: Log errors
					if err != nil {
						return fmt.Errorf("cookpad:recipe: fetch step image: %w", err)
					}
					path := fmt.Sprintf("recipes/%s/step-%03d.jpg", recipeID, i)
					if err := h.saveFile(ctx, path, image); err != nil {
						return fmt.Errorf("cookpad:recipe: save step image: %w", err)
					}
					stepImageURL = fmt.Sprintf("https://storage.googleapis.com/%s/%s", h.publicBucket, path)
				}
				steps[i] = cookchatdb.RecipeStep{
					Description: step,
					ImageURL:    stepImageURL,
				}
				return nil
			})
		}

		err := grp.Wait()
		if err != nil {
			// TODO: Log errors
			return
		}

		recipe = &cookchatdb.Recipe{
			ID:                    recipeID,
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

	if err := h.postProcessRecipe(ctx, recipe); err != nil {
		return nil, err
	}

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

func (h *Handler) postProcessRecipe(ctx context.Context, recipe *cookchatdb.Recipe) error {
	if recipe.Content.Title == "" {
		recipe.Content = cookchatdb.RecipeContent{
			Title:                 recipe.Title,
			Description:           recipe.Description,
			Ingredients:           recipe.Ingredients,
			AdditionalIngredients: recipe.AdditionalIngredients,
			Steps:                 recipe.Steps,
			Notes:                 recipe.Notes,
			ServingSize:           recipe.ServingSize,
		}
	}
	if len(recipe.StepImageURLs) == 0 {
		recipe.StepImageURLs = make([]string, len(recipe.Steps))
		for i, step := range recipe.Steps {
			recipe.StepImageURLs[i] = step.ImageURL
		}
	}
	if len(recipe.LocalizedContent) != 1 {
		sourceJSON, err := json.Marshal(recipe.Content)
		if err != nil {
			return fmt.Errorf("cookpad:recipe: failed to marshal recipe content: %w", err)
		}

		ingredientsSchema := &genai.Schema{
			Type:        "array",
			Description: "The ingredients in English.",
			Items: &genai.Schema{
				Type:        "object",
				Description: "An ingredient in the recipe.",
				Properties: map[string]*genai.Schema{
					"name": {
						Type:        "string",
						Description: "The name of the ingredient in English.",
					},
					"quantity": {
						Type:        "string",
						Description: "The quantity of the ingredient in English.",
					},
				},
				Required: []string{"name", "quantity"},
			},
		}

		res, err := h.genAI.Models.GenerateContent(ctx, "gemini-2.5-flash", []*genai.Content{
			{
				Role: "user",
				Parts: []*genai.Part{
					{
						Text: string(sourceJSON),
					},
				},
			},
		}, &genai.GenerateContentConfig{
			SystemInstruction: &genai.Content{
				Role: "model",
				Parts: []*genai.Part{
					{
						Text: "Translate the provided recipe from Japanese to English.",
					},
				},
			},
			ResponseMIMEType: "application/json",
			ResponseSchema: &genai.Schema{
				Type: "object",
				Properties: map[string]*genai.Schema{
					"en": {
						Type:        "object",
						Description: "The English translation of the recipe.",
						Required:    []string{"title", "description", "ingredients", "additionalIngredients", "steps", "notes", "servingSize"},
						Properties: map[string]*genai.Schema{
							"title": {
								Type:        "string",
								Description: "The English translation of the recipe title.",
							},
							"description": {
								Type:        "string",
								Description: "The English translation of the recipe description.",
							},
							"ingredients": ingredientsSchema,
							"additionalIngredients": {
								Type:        "array",
								Description: "The additional ingredients of the recipe in English, grouped into sections.",
								Items: &genai.Schema{
									Type:        "object",
									Description: "An additional ingredient section in the recipe.",
									Properties: map[string]*genai.Schema{
										"title": {
											Type:        "string",
											Description: "The title of the additional ingredient section in English.",
										},
										"ingredients": ingredientsSchema,
									},
								},
								Required: []string{"title", "ingredients"},
							},
							"steps": {
								Type:        "array",
								Description: "The steps of the recipe in English.",
								Items: &genai.Schema{
									Type:        "object",
									Description: "A step in the recipe.",
									Properties: map[string]*genai.Schema{
										"description": {
											Type:        "string",
											Description: "The description of the step in English.",
										},
									},
									Required: []string{"description"},
								},
							},
							"notes": {
								Type:        "string",
								Description: "Additional notes or comments about the recipe in English.",
							},
							"servingSize": {
								Type:        "string",
								Description: "The serving size of the recipe in English.",
							},
						},
					},
				},
			},
		})
		if err != nil {
			return fmt.Errorf("cookpad:recipe: generate ai translation: %w", err)
		}
		if len(res.Candidates) != 1 || len(res.Candidates[0].Content.Parts) != 1 || res.Candidates[0].Content.Parts[0].Text == "" {
			return fmt.Errorf("cookpad:recipe: unexpected response from generate ai: %v", res)
		}
		text := res.Candidates[0].Content.Parts[0].Text
		if err := json.Unmarshal([]byte(text), &recipe.LocalizedContent); err != nil {
			return fmt.Errorf("cookpad:recipe: failed to unmarshal localized content: %w", err)
		}
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
