// Copyright (c) CurioSwitch (choko@curioswitch.org)
// SPDX-License-Identifier: BUSL-1.1

package recipegen

import (
	"context"
	"encoding/json"
	"fmt"

	"cloud.google.com/go/firestore"
	"golang.org/x/sync/errgroup"
	"google.golang.org/genai"

	"github.com/curioswitch/cookchat/common/cookchatdb"
	"github.com/curioswitch/cookchat/common/image"
	"github.com/curioswitch/cookchat/common/prompts"
)

const verContent = 1

type PostProcessor struct {
	genAI  *genai.Client
	store  *firestore.Client
	images *image.Writer
}

func NewPostProcessor(genAI *genai.Client, store *firestore.Client, images *image.Writer) *PostProcessor {
	return &PostProcessor{
		genAI:  genAI,
		store:  store,
		images: images,
	}
}

func (p *PostProcessor) PostProcessRecipe(ctx context.Context, recipe *cookchatdb.Recipe) error {
	if recipe.LanguageCode == "" {
		recipe.LanguageCode = string(cookchatdb.LanguageCodeJa)
	}
	var targetLanguages []cookchatdb.LanguageCode
	for _, code := range cookchatdb.AllLanguageCodes {
		if recipe.LanguageCode != string(code) {
			targetLanguages = append(targetLanguages, code)
		}
	}

	contentJSONBytes, err := json.Marshal(recipe.Content)
	if err != nil {
		return fmt.Errorf("recipegen: marshalling recipe content for postprocessing: %w", err)
	}
	contentJSON := string(contentJSONBytes)
	if recipe.LocalizedContent == nil {
		recipe.LocalizedContent = map[string]*cookchatdb.RecipeContent{}
	}

	var grp errgroup.Group
	for _, lang := range targetLanguages {
		grp.Go(func() error {
			cnt, err := p.translateRecipe(ctx, recipe.ID, contentJSON, cookchatdb.LanguageCode(recipe.LanguageCode), lang)
			if err != nil {
				return err
			}
			recipe.LocalizedContent[string(lang)] = cnt
			return nil
		})
	}
	for _, lang := range cookchatdb.AllLanguageCodes {
		langAI := string(lang) + "-ai"
		cnt := recipe.LocalizedContent[langAI]
		if cnt != nil && cnt.Version == prompts.VerRewriteRecipe {
			continue
		}
		grp.Go(func() error {
			cnt, err := p.rewriteRecipe(ctx, recipe.ID, contentJSON)
			if err != nil {
				return err
			}
			recipe.LocalizedContent[langAI] = cnt
			return nil
		})
	}
	if recipe.ImageURL == "" {
		grp.Go(func() error {
			url, err := p.generateRecipeImage(ctx, recipe.ID, contentJSON)
			if err != nil {
				return err
			}
			recipe.ImageURL = url
			return nil
		})
	}

	if err := grp.Wait(); err != nil {
		return err
	}

	return nil
}

func (p *PostProcessor) translateRecipe(ctx context.Context, rID string, contentJSON string, from cookchatdb.LanguageCode, to cookchatdb.LanguageCode) (*cookchatdb.RecipeContent, error) {
	res, err := p.genAI.Models.GenerateContent(ctx, "gemini-3-flash-preview", []*genai.Content{
		genai.NewContentFromText(contentJSON, genai.RoleUser),
	}, &genai.GenerateContentConfig{
		SystemInstruction: genai.NewContentFromText(prompts.TranslateRecipe(from, to), genai.RoleModel),
		ResponseMIMEType:  "application/json",
		ResponseSchema:    cookchatdb.RecipeContentSchema,
	})
	if err != nil {
		return nil, fmt.Errorf("recipegen: translating recipe %s from %s to %s: %w", rID, from, to, err)
	}
	text := res.Text()
	if text == "" {
		return nil, fmt.Errorf("recipegen: unexpected response from genai for translation request: %v", res)
	}

	var content cookchatdb.RecipeContent
	if err := json.Unmarshal([]byte(text), &content); err != nil {
		return nil, fmt.Errorf("recipegen: unmarshalling translated recipe %s from %s to %s: %w", rID, from, to, err)
	}
	content.Version = prompts.VerTranslateRecipe
	return &content, nil
}

func (p *PostProcessor) rewriteRecipe(ctx context.Context, rID string, contentJSON string) (*cookchatdb.RecipeContent, error) {
	res, err := p.genAI.Models.GenerateContent(ctx, "gemini-3-flash-preview", []*genai.Content{
		genai.NewContentFromText(contentJSON, genai.RoleUser),
	}, &genai.GenerateContentConfig{
		SystemInstruction: genai.NewContentFromText(prompts.RewriteRecipe(), genai.RoleModel),
		ResponseMIMEType:  "application/json",
		ResponseSchema:    cookchatdb.RecipeContentSchema,
	})
	if err != nil {
		return nil, fmt.Errorf("recipegen: rewriting recipe %s: %w", rID, err)
	}
	text := res.Text()
	if text == "" {
		return nil, fmt.Errorf("recipegen: unexpected response from genai for rewrite request: %v", res)
	}

	var content cookchatdb.RecipeContent
	if err := json.Unmarshal([]byte(text), &content); err != nil {
		return nil, fmt.Errorf("recipegen: unmarshalling rewritten recipe %s: %w", rID, err)
	}
	content.Version = prompts.VerRewriteRecipe
	return &content, nil
}

func (p *PostProcessor) generateRecipeImage(ctx context.Context, rID string, contentJSON string) (string, error) {
	res, err := p.genAI.Models.GenerateContent(ctx, "gemini-3-pro-image-preview", genai.Text(contentJSON), &genai.GenerateContentConfig{
		SystemInstruction: genai.NewContentFromText(prompts.RecipeImage(), genai.RoleModel),
	})
	if err != nil {
		return "", fmt.Errorf("recipegen: generating recipe image for recipe %s: %w", rID, err)
	}
	if len(res.Candidates) != 1 || len(res.Candidates[0].Content.Parts) == 0 {
		return "", fmt.Errorf("recipegen: unexpected response from genai for recipe image generation request: %v", res)
	}
	var blob *genai.Blob
	for _, part := range res.Candidates[0].Content.Parts {
		b := part.InlineData
		if b.MIMEType == "image/jpeg" || b.MIMEType == "image/png" {
			blob = b
			break
		}
	}
	if blob == nil {
		return "", nil
	}

	path := fmt.Sprintf("recipes/%s/%s", rID, "main-image.jpg")
	url, err := p.images.WriteGenAIImage(ctx, path, blob)
	if err != nil {
		return "", fmt.Errorf("recipegen: writing recipe image for recipe %s: %w", rID, err)
	}
	return url, nil
}
