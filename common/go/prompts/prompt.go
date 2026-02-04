// Copyright (c) CurioSwitch (choko@curioswitch.org)
// SPDX-License-Identifier: BUSL-1.1

package prompts

import (
	"fmt"

	"github.com/curioswitch/cookchat/common/cookchatdb"
)

func TranslateRecipe(from cookchatdb.LanguageCode, to cookchatdb.LanguageCode) string {
	return fmt.Sprintf(translateRecipe, languageString(from), languageString(to))
}

const translateRecipe = `
Translate the provided recipe from %s to %s.
`

const VerTranslateRecipe = 1

func languageString(code cookchatdb.LanguageCode) string {
	switch code {
	case cookchatdb.LanguageCodeEn:
		return "English"
	case cookchatdb.LanguageCodeJa:
		return "Japanese"
	default:
		return "unknown language"
	}
}

func RewriteRecipe() string {
	return rewriteRecipe
}

const rewriteRecipe = `
# Role & Objective

You are helping post-process recipes for use in a voice AI assistant. Voice AI models have difficulty reading out certain characteristics of text,
so you must generate recipe content that is optimized for voice AI consumption. We will present the original text content in the UI while providing
the rewritten content to the voice AI.

# Instructions / Rules

- Your output must be in the same language as the input.
- For general recipe instructions, the content should be preserved as-is.
- Japanese only: for ingredients, if the reading in the context of ingredients is different from the normal reading, replace with hiragana of the correct reading.
  Known difficult readings include
| Text  | Reading      |
|-------|--------------|
| 大1   | おおさじ1   |
| 小1   | こさじ1     |
| 1片   | 1へん       |
- Japanese only: for steps, do similar replacements of difficult or context-sensitive readings with hiragana. Do not replace when the reading is simple to
  ensure context of Kanji is preserved as much as possible.
- There are never dates in a recipe. Rewrite any fractions to hiragana if Japanese, or full words rather than numbers for other languages, of the reading as a quantity. For example
	- 1/2 -> にぶんのいち / one half
	- 3/4 -> よんぶんのさん / three fourths
	- 1 1/2 -> いちとにぶんのいち / one and one half
- Ingredients can be defined as variables that are referenced in recipe steps. These are represented as symbols such as ☆. Replace the symbol
  within recipe steps with the full ingredient names corresponding to it. For example, if ingredients include
	- ☆めんつゆ(2倍濃縮)
	- ☆砂糖

	And a step is written as "☆は混ぜておく", rewrite it to "めんつゆ(2倍濃縮)と砂糖は混ぜておく".
- Steps may refer to other steps by number. This is generally not important when actually preparing the recipe - remove step number references.
  For example, if step 3 says "2に菜の花の茎の部分を入れて炒める。", rewrite it to "菜の花の茎の部分を入れて炒める。"
`

const VerRewriteRecipe = 1

func RecipeImage() string {
	return recipeImage
}

const recipeImage = `
# Role & Objective

You support users generating recipes they will cook. Given the details of a recipe as JSON, generate an appropriate image
that represents the recipe. The image will be used for example in list views, search results, etc.

# Instructions / Rules

- The image must be in a realistic photographic style, with good lighting and composition
- The image must not include any text
- The image should be appetizing and relevant to the dish being prepared
- If you cannot generate an appropriate image, respond with "NO_IMAGE". Do not respond with an image in this case.
`
