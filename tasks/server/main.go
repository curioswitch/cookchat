// Copyright (c) CurioSwitch (choko@curioswitch.org)
// SPDX-License-Identifier: BUSL-1.1

package main

import (
	"context"
	"embed"
	"fmt"
	"io/fs"
	"log/slog"
	"net/http"
	"os"
	"strings"

	discoveryengine "cloud.google.com/go/discoveryengine/apiv1"
	"cloud.google.com/go/storage"
	firebase "firebase.google.com/go/v4"
	"github.com/curioswitch/go-curiostack/server"
	"github.com/curioswitch/go-usegcp/middleware/firebaseauth"
	"github.com/go-chi/chi/v5/middleware"
	"google.golang.org/genai"

	"github.com/curioswitch/cookchat/common/file"
	"github.com/curioswitch/cookchat/common/image"
	"github.com/curioswitch/cookchat/common/recipegen"
	tasksapi "github.com/curioswitch/cookchat/tasks/api/go"
	"github.com/curioswitch/cookchat/tasks/api/go/tasksapiconnect"
	"github.com/curioswitch/cookchat/tasks/server/internal/config"
	"github.com/curioswitch/cookchat/tasks/server/internal/handler/fillplan"
)

//go:embed conf/*.yaml
var confFiles embed.FS

func main() {
	conf, _ := fs.Sub(confFiles, "conf")
	os.Exit(server.Main(&config.Config{}, conf, setupServer))
}

func setupServer(ctx context.Context, conf *config.Config, s *server.Server) error {
	mux := server.Mux(s)

	fbApp, err := firebase.NewApp(ctx, &firebase.Config{ProjectID: conf.Google.Project})
	if err != nil {
		return fmt.Errorf("main: create firebase app: %w", err)
	}

	fbAuth, err := fbApp.Auth(ctx)
	if err != nil {
		return fmt.Errorf("main: create firebase auth client: %w", err)
	}

	firestore, err := fbApp.Firestore(ctx)
	if err != nil {
		return fmt.Errorf("main: create firestore client: %w", err)
	}
	defer func() {
		if err := firestore.Close(); err != nil {
			slog.ErrorContext(ctx, "main: close firestore client", "error", err)
		}
	}()

	storage, err := storage.NewGRPCClient(ctx)
	if err != nil {
		return fmt.Errorf("main: create storage client: %w", err)
	}
	defer func() {
		if err := storage.Close(); err != nil {
			slog.ErrorContext(ctx, "main: close storage client", "error", err)
		}
	}()
	publicBucket := conf.Google.Project + "-public"

	search, err := discoveryengine.NewSearchClient(ctx)
	if err != nil {
		return fmt.Errorf("main: create discovery engine search client: %w", err)
	}
	defer func() {
		if err := search.Close(); err != nil {
			slog.ErrorContext(ctx, "main: close discovery engine search client", "error", err)
		}
	}()

	genAI, err := genai.NewClient(ctx, &genai.ClientConfig{
		Backend: genai.BackendGeminiAPI,
		Project: conf.Google.Project,
	})
	if err != nil {
		return fmt.Errorf("creating genai client: %w", err)
	}

	io := file.NewIO(storage, publicBucket)
	processor := recipegen.NewPostProcessor(genAI, firestore, image.NewWriter(io))

	fbMW := firebaseauth.NewMiddleware(fbAuth)

	mux.Use(middleware.Maybe(func(h http.Handler) http.Handler {
		return fbMW(h)
	}, func(r *http.Request) bool {
		switch {
		case strings.HasPrefix(r.URL.Path, "/internal/"):
			return false
		default:
			return true
		}
	}))

	server.HandleConnectUnary(s,
		tasksapiconnect.TasksServiceFillPlanProcedure,
		fillplan.NewHandler(firestore, genAI, processor).FillPlan,
		[]*tasksapi.FillPlanRequest{
			{
				PlanId: "9dtuoh4be12Otv8cevrM",
			},
		},
	)

	server.EnableDocsFirebaseAuth(s, "alpha.cookchat.curioswitch.org")

	if err := server.Start(ctx, s); err != nil {
		return fmt.Errorf("main: starting server: %w", err)
	}
	return nil
}
