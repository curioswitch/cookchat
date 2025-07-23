// Copyright (c) CurioSwitch (choko@curioswitch.org)
// SPDX-License-Identifier: BUSL-1.1

package addrecipe

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"

	"cloud.google.com/go/firestore"
	"cloud.google.com/go/storage"
	"connectrpc.com/connect"

	"github.com/curioswitch/cookchat/common/cookchatdb"
	frontendapi "github.com/curioswitch/cookchat/frontend/api/go"
	"github.com/curioswitch/cookchat/frontend/server/internal/auth"
)

func NewHandler(store *firestore.Client, storage *storage.Client, publicBucket string) *Handler {
	return &Handler{
		store:        store,
		storage:      storage,
		publicBucket: publicBucket,
	}
}

type Handler struct {
	store        *firestore.Client
	storage      *storage.Client
	publicBucket string
}

func (h *Handler) AddRecipe(ctx context.Context, req *frontendapi.AddRecipeRequest) (*frontendapi.AddRecipeResponse, error) {
	if !auth.IsCurioSwitchUser(ctx) {
		return nil, connect.NewError(connect.CodePermissionDenied, errors.New("only CurioSwitch users can add recipes"))
	}

	doc := h.store.Collection("recipes").NewDoc()
	rID := doc.ID
	doc.ID = "user-" + rID
	recipe := cookchatdb.Recipe{
		ID:          rID,
		Source:      cookchatdb.RecipeSourceUser,
		Title:       req.GetTitle(),
		Description: req.GetDescription(),
		ServingSize: req.GetServingSize(),
	}
	switch req.GetLanguage() {
	case frontendapi.Language_LANGUAGE_ENGLISH:
		recipe.LanguageCode = string(cookchatdb.LanguageCodeEn)
	case frontendapi.Language_LANGUAGE_JAPANESE:
		recipe.LanguageCode = string(cookchatdb.LanguageCodeJa)
	case frontendapi.Language_LANGUAGE_UNSPECIFIED:
		// Leave unset
	}
	for _, ingredient := range req.GetIngredients() {
		recipe.Ingredients = append(recipe.Ingredients, cookchatdb.RecipeIngredient{
			Name:     ingredient.GetName(),
			Quantity: ingredient.GetQuantity(),
		})
	}
	for _, ingredientSection := range req.GetAdditionalIngredients() {
		section := cookchatdb.IngredientSection{
			Title: ingredientSection.GetTitle(),
		}
		for _, ingredient := range ingredientSection.GetIngredients() {
			section.Ingredients = append(section.Ingredients, cookchatdb.RecipeIngredient{
				Name:     ingredient.GetName(),
				Quantity: ingredient.GetQuantity(),
			})
		}
		recipe.AdditionalIngredients = append(recipe.AdditionalIngredients, section)
	}
	if req.GetMainImageDataUrl() != "" {
		url, err := h.saveImage(ctx, fmt.Sprintf("recipes/%s/main-image", rID), req.GetMainImageDataUrl())
		if err != nil {
			return nil, fmt.Errorf("addrecipe: saving main image: %w", err)
		}
		recipe.ImageURL = url
	}
	for i, step := range req.GetSteps() {
		imageURL := ""
		if step.GetImageDataUrl() != "" {
			stepURL, err := h.saveImage(ctx, fmt.Sprintf("recipes/%s/step-%03d", rID, i), step.GetImageDataUrl())
			if err != nil {
				return nil, fmt.Errorf("addrecipe: saving step image: %w", err)
			}
			imageURL = stepURL
		}
		recipe.Steps = append(recipe.Steps, cookchatdb.RecipeStep{
			Description: step.GetDescription(),
			ImageURL:    imageURL,
		})
	}

	if _, err := doc.Create(ctx, recipe); err != nil {
		return nil, fmt.Errorf("addrecipe: creating recipe in firestore: %w", err)
	}

	return &frontendapi.AddRecipeResponse{
		RecipeId: rID,
	}, nil
}

func (h *Handler) saveImage(ctx context.Context, pathNoExt string, dataURL string) (string, error) {
	rest, ok := strings.CutPrefix(dataURL, "data:")
	if !ok {
		return "", fmt.Errorf("addrecipe: invalid data URL %q", dataURL)
	}
	ct, contents, ok := strings.Cut(rest, ";")
	if !ok {
		return "", fmt.Errorf("addrecipe: invalid data URL %q", dataURL)
	}

	ext, ok := strings.CutPrefix(ct, "image/")
	if !ok {
		return "", fmt.Errorf("addrecipe: only image data URLs supported, got %q", ct)
	}

	b64, ok := strings.CutPrefix(contents, "base64,")
	if !ok {
		return "", fmt.Errorf("addrecipe: only base64 data URL supported, got %q", dataURL)
	}
	bytes, err := base64.StdEncoding.DecodeString(b64)
	if err != nil {
		return "", fmt.Errorf("addrecipe: decoding base64 data URL: %w", err)
	}
	path := pathNoExt + "." + ext

	w := h.storage.Bucket(h.publicBucket).Object(path).NewWriter(ctx)
	defer func() {
		// TODO: Log error
		_ = w.Close()
	}()
	w.ContentType = ct
	if _, err := w.Write(bytes); err != nil {
		return "", fmt.Errorf("addrecipe: save image: %w", err)
	}
	if err := w.Close(); err != nil {
		return "", fmt.Errorf("addrecipe: closing writer: %w", err)
	}
	return fmt.Sprintf("https://storage.googleapis.com/%s/%s", h.publicBucket, path), nil
}
