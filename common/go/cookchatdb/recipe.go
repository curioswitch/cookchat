// Copyright (c) CurioSwitch (choko@curioswitch.org)
// SPDX-License-Identifier: BUSL-1.1

package cookchatdb

import (
	"time"

	"google.golang.org/genai"
)

type RecipeSource string

const (
	// RecipeSourceCookpad is the source for recipes from cookpad.
	RecipeSourceCookpad RecipeSource = "cookpad"
	// RecipeSourceUser is the source for user-submitted recipes.
	RecipeSourceUser RecipeSource = "user"
)

type LanguageCode string

const (
	LanguageCodeEn LanguageCode = "en"
	LanguageCodeJa LanguageCode = "ja"
)

type RecipeType string

const (
	RecipeTypeUnknown  RecipeType = "unknown"
	RecipeTypeMainDish RecipeType = "main_dish"
	RecipeTypeSideDish RecipeType = "side_dish"
	RecipeTypeSoup     RecipeType = "soup"
)

type RecipeGenre string

const (
	RecipeGenreUnknown  RecipeGenre = "unknown"
	RecipeGenreJapanese RecipeGenre = "japanese"
	RecipeGenreChinese  RecipeGenre = "chinese"
	RecipeGenreWestern  RecipeGenre = "western"
	RecipeGenreKorean   RecipeGenre = "korean"
	RecipeGenreItalian  RecipeGenre = "italian"
	RecipeGenreEthnic   RecipeGenre = "ethnic"
)

// RecipeIngredient represents an ingredient in a recipe.
type RecipeIngredient struct {
	// Name is the name of the ingredient.
	Name string `firestore:"name"`

	// Quantity is the quantity of the ingredient as free-form text.
	Quantity string `firestore:"quantity"`
}

// RecipeStep represents a step in a recipe.
type RecipeStep struct {
	// Description is the description of the step.
	Description string `firestore:"description"`

	// ImageURL is the URL of an image of the step.
	ImageURL string `firestore:"imageUrl"`
}

// IngredientSection represents a section of ingredients in a recipe.
type IngredientSection struct {
	// Title is the title of the ingredient section.
	Title string `firestore:"title"`

	// Ingredients are the ingredients in the section.
	Ingredients []RecipeIngredient `firestore:"ingredients"`
}

// RecipeContent is the text content of a recipe.
type RecipeContent struct {
	// Title is the title of the recipe.
	Title string `firestore:"title" json:"title"`

	// Description is the description of the recipe.
	Description string `firestore:"description" json:"description"`

	// Ingredients are the main ingredients of the recipe.
	Ingredients []RecipeIngredient `firestore:"ingredients" json:"ingredients"`

	// AdditionalIngredients are additional ingredients grouped into sections.
	AdditionalIngredients []IngredientSection `firestore:"additionalIngredients" json:"additionalIngredients"`

	// Steps are the steps to prepare the recipe.
	Steps []RecipeStep `firestore:"steps" json:"steps"`

	// Notes are additional notes or comments about the recipe.
	Notes string `firestore:"notes" json:"notes"`

	// ServingSize is the serving size of the recipe as free-form text.
	ServingSize string `firestore:"servingSize" json:"servingSize"`
}

// Recipe represents a recipe stored in Firestore.
type Recipe struct {
	// ID is the unique identifier of the recipe within cookchat.
	ID string `firestore:"id"`

	// Source is the source of the recipe.
	Source RecipeSource `firestore:"source"`

	// SourceID is the ID of the recipe in the source.
	SourceID string `firestore:"sourceId"`

	// UserID is the ID of the user who created the recipe.
	UserID string `firestore:"userId"`

	// Type is the type of the recipe.
	Type RecipeType `firestore:"type"`

	// Genre is the genre of the recipe.
	Genre RecipeGenre `firestore:"genre"`

	// Title is the title of the recipe.
	Title string `firestore:"title"`

	// ImageURL is the URL for the main image of the recipe.
	ImageURL string `firestore:"imageUrl"`

	// Description is the description of the recipe.
	Description string `firestore:"description"`

	// Ingredients are the main ingredients of the recipe.
	Ingredients []RecipeIngredient `firestore:"ingredients"`

	// AdditionalIngredients are additional ingredients grouped into sections.
	AdditionalIngredients []IngredientSection `firestore:"additionalIngredients"`

	// Steps are the steps to prepare the recipe.
	Steps []RecipeStep `firestore:"steps"`

	// StepImageURLs are URLs for images of the steps in the recipe.
	StepImageURLs []string `firestore:"stepImageUrls"`

	// Notes are additional notes or comments about the recipe.
	Notes string `firestore:"notes"`

	// ServingSize is the serving size of the recipe as free-form text.
	ServingSize string `firestore:"servingSize"`

	// LanguageCode is the source language code of the recipe.
	// For example, "en" for English, "ja" for Japanese.
	LanguageCode string `firestore:"languageCode"`

	// Content contains the content of the recipe in its source language.
	Content RecipeContent `firestore:"content"`

	// LocalizedContent contains localized content for the recipe.
	LocalizedContent map[string]*RecipeContent `firestore:"localizedContent,omitempty"`
}

// RecipeBookmark is a bookmarked recipe.
type RecipeBookmark struct {
	// The ID of the recipe being bookmarked.
	RecipeID string `firestore:"recipeId"`

	// The time the bookmark was created.
	CreatedAt time.Time `firestore:"createdAt"`
}

var ingredientsSchema = &genai.Schema{
	Type:        "array",
	Description: "A list of ingredients",
	Items: &genai.Schema{
		Type:        "object",
		Description: "An ingredient in the recipe.",
		Properties: map[string]*genai.Schema{
			"name": {
				Type:        "string",
				Description: "The name of the ingredient.",
			},
			"quantity": {
				Type:        "string",
				Description: "The quantity of the ingredient.",
			},
		},
		Required: []string{"name", "quantity"},
	},
}

var RecipeContentSchema = &genai.Schema{
	Type:        "object",
	Description: "The text content of a recipe.",
	Required:    []string{"title", "description", "ingredients", "additionalIngredients", "steps", "notes", "servingSize"},
	Properties: map[string]*genai.Schema{
		"title": {
			Type:        "string",
			Description: "The title of the recipe.",
		},
		"description": {
			Type:        "string",
			Description: "The description of the recipe.",
		},
		"ingredients": ingredientsSchema,
		"additionalIngredients": {
			Type:        "array",
			Description: "The additional ingredients of the recipe, grouped into sections.",
			Items: &genai.Schema{
				Type:        "object",
				Description: "An additional ingredient section in the recipe.",
				Properties: map[string]*genai.Schema{
					"title": {
						Type:        "string",
						Description: "The title of the additional ingredient section.",
					},
					"ingredients": ingredientsSchema,
				},
				Required: []string{"title", "ingredients"},
			},
		},
		"steps": {
			Type:        "array",
			Description: "The steps of the recipe.",
			Items: &genai.Schema{
				Type:        "object",
				Description: "A step in the recipe.",
				Properties: map[string]*genai.Schema{
					"description": {
						Type:        "string",
						Description: "The description of the step.",
					},
				},
				Required: []string{"description"},
			},
		},
		"notes": {
			Type:        "string",
			Description: "Additional notes or comments about the recipe.",
		},
		"servingSize": {
			Type:        "string",
			Description: "The serving size of the recipe.",
		},
	},
}

var LocalizedRecipeContentSchema = &genai.Schema{
	Type:        "object",
	Description: "Localized content for a recipe.",
	Properties: map[string]*genai.Schema{
		"en": RecipeContentSchema,
		"ja": RecipeContentSchema,
	},
}
