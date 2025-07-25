package cookchatdb

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
