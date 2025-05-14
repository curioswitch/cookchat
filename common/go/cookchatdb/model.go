package cookchatdb

type RecipeSource string

const (
	// RecipeSourceCookpad is the source for recipes from cookpad.
	RecipeSourceCookpad RecipeSource = "cookpad"
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

	// Image is an image of the step.
	Image []byte `firestore:"image"`
}

// IngredientSection represents a section of ingredients in a recipe.
type IngredientSection struct {
	// Title is the title of the ingredient section.
	Title string `firestore:"title"`

	// Ingredients are the ingredients in the section.
	Ingredients []RecipeIngredient `firestore:"ingredients"`
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

	// Image is the main image of the recipe.
	Image []byte `firestore:"image"`

	// Description is the description of the recipe.
	Description string `firestore:"description"`

	// Ingredients are the main ingredients of the recipe.
	Ingredients []RecipeIngredient `firestore:"ingredients"`

	// AdditionalIngredients are additional ingredients grouped into sections.
	AdditionalIngredients []IngredientSection `firestore:"additionalIngredients"`

	// Steps are the steps to prepare the recipe.
	Steps []RecipeStep `firestore:"steps"`

	// Notes are additional notes or comments about the recipe.
	Notes string `firestore:"notes"`

	// LanuageCode is the language code of the recipe.
	// For example, "en" for English, "ja" for Japanese.
	LanguageCode string `firestore:"languageCode"`
}
