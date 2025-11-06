// Copyright (c) CurioSwitch (choko@curioswitch.org)
// SPDX-License-Identifier: BUSL-1.1

package recipe

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"image/jpeg"
	"image/png"
	"strings"

	"cloud.google.com/go/firestore"
	"cloud.google.com/go/storage"
	"github.com/gocolly/colly/v2"
	"golang.org/x/sync/errgroup"
	"google.golang.org/genai"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/curioswitch/cookchat/common/cookchatdb"
	crawlerapi "github.com/curioswitch/cookchat/crawler/api/go"
)

var errMalformedID = errors.New("cookpad:recipe: malformed ID in existing recipe")

type howToStep struct {
	Text string `json:"text"`
}

type recipeSchema struct {
	Type               string      `json:"@type"`
	Description        string      `json:"description"`
	Name               string      `json:"name"`
	RecipeIngredient   []string    `json:"recipeIngredient"`
	RecipeInstructions []howToStep `json:"recipeInstructions"`
	RecipeYield        string      `json:"recipeYield"`
}

type orangepadSchema struct {
	Graph []recipeSchema `json:"@graph"`
}

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

func (h *Handler) CrawlRecipe(ctx context.Context, req *crawlerapi.CrawlRecipeRequest) (*crawlerapi.CrawlRecipeResponse, error) {
	// Avoid clone since we don't want to share storage.
	c := colly.NewCollector(
		colly.UserAgent(h.baseCollector.UserAgent),
		colly.StdlibContext(ctx),
	)

	var recipe *cookchatdb.Recipe

	var sourceID string
	var source cookchatdb.RecipeSource
	switch {
	case strings.HasPrefix(req.GetUrl(), "https://www.orangepage.net/recipes/"):
		sourceID = req.GetUrl()[len("https://www.orangepage.net/recipes/"):]
		source = cookchatdb.RecipeSourceOrangePage
	case strings.HasPrefix(req.GetUrl(), "https://delishkitchen.tv/recipes/"):
		sourceID = req.GetUrl()[len("https://delishkitchen.tv/recipes/"):]
		source = cookchatdb.RecipeSourceDelishKitchen
	default:
		return nil, fmt.Errorf("recipe: unsupported recipe URL: %s", req.GetUrl())
	}

	recipes := h.store.Collection("recipes")
	doc := recipes.Doc(fmt.Sprintf("%s-%s", source, sourceID))
	existing, err := doc.Get(ctx)
	if err != nil && status.Code(err) != codes.NotFound {
		return nil, fmt.Errorf("recipe: failed to get existing recipe: %w", err)
	}
	if existing.Exists() {
		var recipe *cookchatdb.Recipe
		if err := existing.DataTo(&recipe); err != nil {
			return nil, fmt.Errorf("recipe: failed to unmarshal existing recipe: %w", err)
		}
		if err := h.postProcessRecipe(ctx, recipe); err != nil {
			return nil, err
		}
		if _, err := doc.Set(ctx, recipe); err != nil {
			return nil, fmt.Errorf("recipe: failed to update existing recipe: %w", err)
		}
		return &crawlerapi.CrawlRecipeResponse{}, nil
	}

	// Follow firestore conventions for IDs, though we don't use it in the actual document ID.
	recipeID := recipes.NewDoc().ID

	c.OnHTML(`script[type="application/ld+json"]`, func(e *colly.HTMLElement) {
		if recipe != nil {
			return
		}

		var recipeJSON recipeSchema

		switch source { //nolint:exhaustive
		case cookchatdb.RecipeSourceOrangePage:
			var schema orangepadSchema
			if err := json.Unmarshal([]byte(e.Text), &schema); err != nil {
				// TODO: Log errors
				return
			}
			if len(schema.Graph) < 3 {
				// TODO: Log errors
				return
			}
			recipeJSON = schema.Graph[2]
		case cookchatdb.RecipeSourceDelishKitchen:
			if err := json.Unmarshal([]byte(e.Text), &recipeJSON); err != nil {
				// TODO: Log errors
				return
			}
			if recipeJSON.Type != "Recipe" {
				return
			}
		default:
			// Should not happen.
			return
		}

		description := recipeJSON.Description
		servingSize := recipeJSON.RecipeYield

		ingredients := make([]cookchatdb.RecipeIngredient, len(recipeJSON.RecipeIngredient))
		for i, ingredientText := range recipeJSON.RecipeIngredient {
			name, quantity, _ := strings.Cut(ingredientText, " ")
			ingredients[i] = cookchatdb.RecipeIngredient{
				Name:     name,
				Quantity: quantity,
			}
		}

		steps := make([]cookchatdb.RecipeStep, len(recipeJSON.RecipeInstructions))
		for i, stepJSON := range recipeJSON.RecipeInstructions {
			steps[i] = cookchatdb.RecipeStep{
				Description: stepJSON.Text,
			}
		}

		recipe = &cookchatdb.Recipe{
			ID:           recipeID,
			Source:       source,
			SourceID:     sourceID,
			Title:        recipeJSON.Name,
			Description:  description,
			Ingredients:  ingredients,
			Steps:        steps,
			ServingSize:  servingSize,
			LanguageCode: "ja",
		}
	})

	if err := c.Visit(req.GetUrl()); err != nil {
		return nil, fmt.Errorf("recipe: failed to scrape page: %w", err)
	}

	if err := h.postProcessRecipe(ctx, recipe); err != nil {
		return nil, err
	}

	if _, err := doc.Create(ctx, recipe); err != nil {
		if status.Code(err) != codes.AlreadyExists {
			return nil, fmt.Errorf("recipe: failed to create recipe: %w", err)
		}
		existing, err := doc.Get(ctx)
		if err != nil {
			return nil, fmt.Errorf("recipe: failed to get existing recipe: %w", err)
		}
		// TODO: We can save an RPC by using a merge instead of fetching, but it's tedious since
		// it doesn't support structs.
		id, ok := existing.Data()["id"].(string)
		if !ok {
			return nil, errMalformedID
		}
		recipe.ID = id
		if _, err := doc.Set(ctx, recipe); err != nil {
			return nil, fmt.Errorf("recipe: failed to update recipe: %w", err)
		}
	}

	return &crawlerapi.CrawlRecipeResponse{}, nil
}

type classificationResult struct {
	Type  cookchatdb.RecipeType  `json:"type"`
	Genre cookchatdb.RecipeGenre `json:"genre"`
}

func (h *Handler) postProcessRecipe(ctx context.Context, recipe *cookchatdb.Recipe) error {
	sourceJSON, err := json.Marshal(recipe)
	if err != nil {
		return fmt.Errorf("recipe: failed to marshal recipe content: %w", err)
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
					Text: "Read the provided recipe and return the same recipe, with title, recipe description, and step description updated to be told by you, in Japanese. Do not copy-paste the input as-is, but update these by retelling them. It must be the same recipe conceptually. Return all other fields as-is from the input.",
				},
			},
		},
		ResponseMIMEType: "application/json",
		ResponseSchema:   cookchatdb.RecipeContentSchema,
	})
	if err != nil {
		return fmt.Errorf("recipe: recreate recipe: %w", err)
	}
	if len(res.Candidates) != 1 || len(res.Candidates[0].Content.Parts) != 1 || res.Candidates[0].Content.Parts[0].Text == "" {
		return fmt.Errorf("cookpad:recipe: unexpected recipe recreation response from generate ai: %v", res)
	}
	if err := json.Unmarshal([]byte(res.Candidates[0].Content.Parts[0].Text), &recipe); err != nil {
		return fmt.Errorf("recipe: unmarshal recreated recipe: %w", err)
	}

	if true { // if recipe.Content.Title == "" {
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
	hasImage := recipe.ImageURL != ""

	if len(recipe.StepImageURLs) == 0 {
		recipe.StepImageURLs = make([]string, len(recipe.Steps))
		for i, step := range recipe.Steps {
			recipe.StepImageURLs[i] = step.ImageURL
			if step.ImageURL != "" {
				hasImage = true
			}
		}
	}

	sourceJSON, err = json.Marshal(recipe.Content)
	if err != nil {
		return fmt.Errorf("recipe: failed to marshal recipe content: %w", err)
	}

	if true || !hasImage {
		prompts := []string{
			"Generate an photo for the provided recipe. This usually represents the final product. If you cannot generate a photo with confidence it represents the recipe, do not return an image.",
		}
		for range recipe.Content.Steps {
			prompts = append(prompts, "Generate a photo for the provided recipe step. This usually represents the ingredients used in the step and possibly action described in the step. If you cannot generate a photo with confidence it represents the step, do not return an image.")
		}

		var grp errgroup.Group
		imageURLs := make([]string, len(prompts))
		for i, prompt := range prompts {
			grp.Go(func() error {
				var content string
				if i == 0 {
					content = string(sourceJSON)
				} else {
					content = recipe.Steps[i-1].Description
				}

				res, err := h.genAI.Models.GenerateContent(ctx, "gemini-2.5-flash-image", []*genai.Content{
					{
						Role: "user",
						Parts: []*genai.Part{
							{
								Text: content,
							},
						},
					},
				}, &genai.GenerateContentConfig{
					ResponseModalities: []string{"IMAGE"},
					SystemInstruction: &genai.Content{
						Role: "model",
						Parts: []*genai.Part{
							{
								Text: prompt,
							},
						},
					},
				})
				if err != nil {
					return fmt.Errorf("recipe: generate ai image: %w", err)
				}
				if len(res.Candidates) > 0 && len(res.Candidates[0].Content.Parts) > 0 && res.Candidates[0].Content.Parts[0].InlineData != nil {
					filename := "main-image.jpg"
					if i > 0 {
						filename = fmt.Sprintf("step-%03d.jpg", i-1)
					}

					imageBlob := res.Candidates[0].Content.Parts[0].InlineData
					image := imageBlob.Data
					if imageBlob.MIMEType == "image/png" {
						img, err := png.Decode(bytes.NewReader(image))
						if err != nil {
							return fmt.Errorf("recipe: decoding png image: %w", err)
						}
						var buf bytes.Buffer
						if err := jpeg.Encode(&buf, img, nil); err != nil {
							return fmt.Errorf("recipe: encoding png to jpeg: %w", err)
						}
						image = buf.Bytes()
					} else if imageBlob.MIMEType != "image/jpeg" {
						return nil
					}

					path := fmt.Sprintf("recipes/%s/%s", recipe.ID, filename)
					if err := h.saveFile(ctx, path, image); err != nil {
						return fmt.Errorf("recipe: saving image to storage: %w", err)
					}

					imageURLs[i] = fmt.Sprintf("https://storage.googleapis.com/%s/%s", h.publicBucket, path)
				}
				return nil
			})
		}
		if err := grp.Wait(); err != nil {
			return err
		}
		recipe.ImageURL = imageURLs[0]
		for i := 1; i < len(imageURLs); i++ {
			recipe.StepImageURLs[i-1] = imageURLs[i]
			recipe.Steps[i-1].ImageURL = imageURLs[i]
		}
	}

	if true { // len(recipe.LocalizedContent) != 1 {
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
									Required: []string{"title", "ingredients"},
								},
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
			return fmt.Errorf("cookpad:recipe: unexpected translate response from generate ai: %v", res)
		}
		text := res.Candidates[0].Content.Parts[0].Text
		if err := json.Unmarshal([]byte(text), &recipe.LocalizedContent); err != nil {
			return fmt.Errorf("cookpad:recipe: failed to unmarshal localized content: %w", err)
		}
	}

	if recipe.Type == "" || recipe.Genre == "" {
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
						Text: "Classify the type and genre of the recipe. Return unknown for either if low confidence.",
					},
				},
			},
			ResponseMIMEType: "application/json",
			ResponseSchema: &genai.Schema{
				Type: "object",
				Properties: map[string]*genai.Schema{
					"type": {
						Type:        "string",
						Description: "The type of the recipe.",
						Enum:        []string{string(cookchatdb.RecipeTypeUnknown), string(cookchatdb.RecipeTypeMainDish), string(cookchatdb.RecipeTypeSideDish), string(cookchatdb.RecipeTypeSoup)},
					},
					"genre": {
						Type:        "string",
						Description: "The genre of the recipe.",
						Enum: []string{
							string(cookchatdb.RecipeGenreUnknown),
							string(cookchatdb.RecipeGenreJapanese),
							string(cookchatdb.RecipeGenreWestern),
							string(cookchatdb.RecipeGenreChinese),
							string(cookchatdb.RecipeGenreEthnic),
						},
					},
				},
				Required: []string{"type", "genre"},
			},
		})
		if err != nil {
			return fmt.Errorf("cookpad:recipe: classify recipe: %w", err)
		}
		if len(res.Candidates) != 1 || len(res.Candidates[0].Content.Parts) != 1 || res.Candidates[0].Content.Parts[0].Text == "" {
			return fmt.Errorf("cookpad:recipe: unexpected classification response from generate ai: %v", res)
		}
		text := res.Candidates[0].Content.Parts[0].Text
		var classRes classificationResult
		if err := json.Unmarshal([]byte(text), &classRes); err != nil {
			return fmt.Errorf("cookpad:recipe: failed to unmarshal classification result: %w", err)
		}
		recipe.Type = classRes.Type
		recipe.Genre = classRes.Genre
	}

	return nil
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
