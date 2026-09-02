// Copyright (c) CurioSwitch (choko@curioswitch.org)
// SPDX-License-Identifier: BUSL-1.1

// Command jhf imports the static Japan Heart Foundation Heart Recipe snapshot.
package main

import (
	"context"
	"embed"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"sync/atomic"
	"time"

	"cloud.google.com/go/storage"
	firebase "firebase.google.com/go/v4"
	"github.com/curioswitch/go-curiostack/server"
	"golang.org/x/sync/errgroup"
	"google.golang.org/genai"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/curioswitch/cookchat/common/cookchatdb"
	"github.com/curioswitch/cookchat/common/file"
	"github.com/curioswitch/cookchat/common/image"
	"github.com/curioswitch/cookchat/common/recipegen"
	"github.com/curioswitch/cookchat/crawler/server/internal/config"
)

var confFiles embed.FS

//go:embed recipes.json
var recipesJSON []byte

var resumeFrom = flag.String("resume-from", "", "source ID to resume from, inclusive")

type sourceRecipe struct {
	SourceID string                   `json:"sourceId"`
	Content  cookchatdb.RecipeContent `json:"content"`
}

func main() {
	flag.Parse()
	os.Exit(server.Main(&config.Config{}, confFiles, runBatch))
}

func runBatch(ctx context.Context, conf *config.Config, _ *server.Server) error {
	if err := run(ctx, conf.Google.Project, conf.Google.Project+"-public", *resumeFrom); err != nil {
		return err
	}

	// server.Main expects callbacks to start a server. This command is a one-shot
	// batch, so exit after the callback has finished all work and cleanup.
	os.Exit(0)
	return nil
}

func run(ctx context.Context, project, bucket, resumeFrom string) error {
	var sourceRecipes []sourceRecipe
	if err := json.Unmarshal(recipesJSON, &sourceRecipes); err != nil {
		return fmt.Errorf("decode embedded recipes: %w", err)
	}
	if err := validate(sourceRecipes); err != nil {
		return err
	}
	sourceRecipes, err := recipesToImport(sourceRecipes, resumeFrom)
	if err != nil {
		return err
	}

	app, err := firebase.NewApp(ctx, &firebase.Config{ProjectID: project})
	if err != nil {
		return fmt.Errorf("create Firebase app: %w", err)
	}
	store, err := app.Firestore(ctx)
	if err != nil {
		return fmt.Errorf("create Firestore client: %w", err)
	}
	defer func() {
		if err := store.Close(); err != nil {
			slog.ErrorContext(ctx, "close Firestore client", "error", err)
		}
	}()

	storageClient, err := storage.NewGRPCClient(ctx)
	if err != nil {
		return fmt.Errorf("create Storage client: %w", err)
	}
	defer func() {
		if err := storageClient.Close(); err != nil {
			slog.ErrorContext(ctx, "close Storage client", "error", err)
		}
	}()

	genAI, err := genai.NewClient(ctx, &genai.ClientConfig{
		Backend:  genai.BackendVertexAI,
		Project:  project,
		Location: "global",
	})
	if err != nil {
		return fmt.Errorf("create GenAI client: %w", err)
	}
	processor := recipegen.NewPostProcessor(genAI, store, image.NewWriter(file.NewIO(storageClient, bucket)))
	recipes := store.Collection("recipes")
	grp, grpCtx := errgroup.WithContext(ctx)
	grp.SetLimit(8)
	var completed atomic.Int64

	for _, source := range sourceRecipes {
		grp.Go(func() error {
			doc := recipes.Doc(string(cookchatdb.RecipeSourceJHF) + "-" + source.SourceID)
			recipeID := recipes.NewDoc().ID
			existing, err := doc.Get(grpCtx)
			switch {
			case err == nil:
				var existingRecipe struct {
					ID string `firestore:"id"`
				}
				if err := existing.DataTo(&existingRecipe); err != nil {
					return fmt.Errorf("decode existing recipe %s: %w", source.SourceID, err)
				}
				if existingRecipe.ID == "" {
					return fmt.Errorf("existing recipe %s has an empty ID", source.SourceID)
				}
				recipeID = existingRecipe.ID
			case status.Code(err) != codes.NotFound:
				return fmt.Errorf("read recipe %s: %w", source.SourceID, err)
			}

			recipe := &cookchatdb.Recipe{
				ID:           recipeID,
				Source:       cookchatdb.RecipeSourceJHF,
				SourceID:     source.SourceID,
				Status:       cookchatdb.RecipeStatusProcessing,
				Type:         cookchatdb.RecipeTypeUnknown,
				Genre:        cookchatdb.RecipeGenreUnknown,
				LanguageCode: string(cookchatdb.LanguageCodeJa),
				Content:      source.Content,
			}
			slog.Info("post-processing recipe", "sourceId", source.SourceID, "title", source.Content.Title)
			if err := postProcessWithRetry(grpCtx, processor, recipe); err != nil {
				return fmt.Errorf("post-process recipe %s: %w", source.SourceID, err)
			}
			recipe.Status = cookchatdb.RecipeStatusActive
			if _, err := doc.Set(grpCtx, recipe); err != nil {
				return fmt.Errorf("write recipe %s: %w", source.SourceID, err)
			}
			slog.Info("recipe imported", "progress", fmt.Sprintf("%d/%d", completed.Add(1), len(sourceRecipes)), "sourceId", source.SourceID)
			return nil
		})
	}
	return grp.Wait()
}

func recipesToImport(recipes []sourceRecipe, resumeFrom string) ([]sourceRecipe, error) {
	if resumeFrom == "" {
		return recipes, nil
	}
	for i, recipe := range recipes {
		if recipe.SourceID == resumeFrom {
			return recipes[i:], nil
		}
	}
	return nil, fmt.Errorf("resume source ID %q not found", resumeFrom)
}

func postProcessWithRetry(ctx context.Context, processor *recipegen.PostProcessor, recipe *cookchatdb.Recipe) error {
	const maxAttempts = 6
	backoff := 10 * time.Second
	for attempt := 1; ; attempt++ {
		err := processor.PostProcessRecipe(ctx, recipe)
		if err == nil || !isRetryable(err) || attempt == maxAttempts {
			if err != nil {
				return fmt.Errorf("post-process attempt %d: %w", attempt, err)
			}
			return nil
		}

		delay := backoff
		slog.Warn("transient post-processing failure; retrying", "sourceId", recipe.SourceID, "attempt", attempt, "nextAttempt", attempt+1, "delay", delay, "error", err)
		timer := time.NewTimer(delay)
		select {
		case <-ctx.Done():
			timer.Stop()
			return fmt.Errorf("wait to retry post-processing: %w", ctx.Err())
		case <-timer.C:
		}

		// A failed post-processing attempt can leave partially generated fields.
		// Clear them so the retry regenerates every translation and image.
		recipe.LocalizedContent = nil
		recipe.ImageURL = ""
		recipe.StepImageURLs = nil
		backoff = min(backoff*2, time.Minute)
	}
}

func isRetryable(err error) bool {
	var apiErr genai.APIError
	if !errors.As(err, &apiErr) {
		return false
	}
	switch apiErr.Code {
	case http.StatusTooManyRequests, http.StatusInternalServerError, http.StatusBadGateway, http.StatusServiceUnavailable, http.StatusGatewayTimeout:
		return true
	default:
		return false
	}
}

func validate(recipes []sourceRecipe) error {
	if len(recipes) == 0 {
		return errors.New("embedded recipe list is empty")
	}
	seen := make(map[string]struct{}, len(recipes))
	for i, recipe := range recipes {
		if recipe.SourceID == "" || recipe.Content.SourceURL == "" || recipe.Content.Title == "" || len(recipe.Content.Ingredients) == 0 || len(recipe.Content.Steps) == 0 {
			return fmt.Errorf("recipe %d is missing a source ID, source URL, title, ingredients, or steps", i)
		}
		if _, ok := seen[recipe.SourceID]; ok {
			return fmt.Errorf("duplicate source ID %q", recipe.SourceID)
		}
		seen[recipe.SourceID] = struct{}{}
	}
	return nil
}
