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
	"slices"
	"strings"

	cloudtasks "cloud.google.com/go/cloudtasks/apiv2"
	discoveryengine "cloud.google.com/go/discoveryengine/apiv1"
	"cloud.google.com/go/storage"
	firebase "firebase.google.com/go/v4"
	"github.com/curioswitch/go-curiostack/server"
	"github.com/curioswitch/go-usegcp/middleware/firebaseauth"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/openai/openai-go/v3"
	"google.golang.org/genai"

	frontendapi "github.com/curioswitch/cookchat/frontend/api/go"
	"github.com/curioswitch/cookchat/frontend/api/go/frontendapiconnect"
	"github.com/curioswitch/cookchat/frontend/server/internal/config"
	"github.com/curioswitch/cookchat/frontend/server/internal/handler/addbookmark"
	"github.com/curioswitch/cookchat/frontend/server/internal/handler/addrecipe"
	"github.com/curioswitch/cookchat/frontend/server/internal/handler/chatplan"
	"github.com/curioswitch/cookchat/frontend/server/internal/handler/deleteplan"
	"github.com/curioswitch/cookchat/frontend/server/internal/handler/edituser"
	"github.com/curioswitch/cookchat/frontend/server/internal/handler/generateplan"
	"github.com/curioswitch/cookchat/frontend/server/internal/handler/generaterecipe"
	"github.com/curioswitch/cookchat/frontend/server/internal/handler/getchatmessages"
	"github.com/curioswitch/cookchat/frontend/server/internal/handler/getplan"
	"github.com/curioswitch/cookchat/frontend/server/internal/handler/getplans"
	"github.com/curioswitch/cookchat/frontend/server/internal/handler/getrecipe"
	"github.com/curioswitch/cookchat/frontend/server/internal/handler/getuser"
	"github.com/curioswitch/cookchat/frontend/server/internal/handler/listrecipes"
	"github.com/curioswitch/cookchat/frontend/server/internal/handler/removebookmark"
	"github.com/curioswitch/cookchat/frontend/server/internal/handler/startchat"
	"github.com/curioswitch/cookchat/frontend/server/internal/handler/updateplan"
	"github.com/curioswitch/cookchat/frontend/server/internal/i18n"
)

//go:embed conf/*.yaml
var confFiles embed.FS

func main() {
	conf, _ := fs.Sub(confFiles, "conf")
	os.Exit(server.Main(&config.Config{}, conf, setupServer))
}

func setupServer(ctx context.Context, conf *config.Config, s *server.Server) error {
	mux := s.Mux()

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
	})
	if err != nil {
		return fmt.Errorf("creating genai client: %w", err)
	}

	tasks, err := cloudtasks.NewClient(ctx)
	if err != nil {
		return fmt.Errorf("main: create cloud tasks client: %w", err)
	}
	defer func() {
		if err := tasks.Close(); err != nil {
			slog.ErrorContext(ctx, "main: close cloud tasks client", "error", err)
		}
	}()

	oai := openai.NewClient()

	authorizedEmails := strings.Split(conf.Authorization.EmailsCSV, ",")

	fbMW := firebaseauth.NewMiddleware(fbAuth)
	requireAccess := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			tok := firebaseauth.TokenFromContext(r.Context())
			if id, ok := tok.Firebase.Identities["email"]; ok {
				if idAny, ok := id.([]any); ok && len(idAny) > 0 {
					if email, ok := idAny[0].(string); ok {
						if strings.HasSuffix(email, "@curioswitch.org") || slices.Contains(authorizedEmails, email) {
							next.ServeHTTP(w, r)
							return
						}
					}
				}
			}
			http.Error(w, "permission denied", http.StatusForbidden)
		})
	}

	mux.Use(middleware.Maybe(func(h http.Handler) http.Handler {
		return fbMW(requireAccess(h))
	}, func(r *http.Request) bool {
		switch {
		case strings.HasPrefix(r.URL.Path, "/internal/"):
			return false
		default:
			return true
		}
	}))

	mux.Use(i18n.Middleware())

	service := newFrontendService(
		addbookmark.NewHandler(firestore),
		addrecipe.NewHandler(firestore, storage, publicBucket),
		chatplan.NewHandler(genAI, firestore, search, tasks, conf.Tasks, conf.Google.Project+"-files"),
		deleteplan.NewHandler(genAI, firestore),
		edituser.NewHandler(firestore),
		generateplan.NewHandler(genAI, firestore, search, tasks, conf.Tasks),
		generaterecipe.NewHandler(genAI, firestore, storage, publicBucket),
		getchatmessages.NewHandler(firestore),
		getplan.NewHandler(firestore),
		getplans.NewHandler(firestore),
		getrecipe.NewHandler(firestore),
		getuser.NewHandler(firestore),
		listrecipes.NewHandler(firestore, search, conf.Search.Engine),
		removebookmark.NewHandler(firestore),
		startchat.NewHandler(genAI, &oai, firestore),
		updateplan.NewHandler(genAI, firestore),
	)

	s.AddConnectService(frontendapiconnect.RegisterFrontendServiceHandler, service)
	s.AddSampleRequests(
		frontendapiconnect.FrontendServiceGetRecipeProcedure,
		&frontendapi.GetRecipeRequest{
			RecipeId: "02JNMi0W1605TLxzQt6v",
		},
	)

	s.AddSampleRequests(
		frontendapiconnect.FrontendServiceListRecipesProcedure,
		&frontendapi.ListRecipesRequest{},
		&frontendapi.ListRecipesRequest{
			Query: "玉ねぎ",
		},
		&frontendapi.ListRecipesRequest{
			Bookmarks: true,
		},
	)

	s.AddSampleRequests(
		frontendapiconnect.FrontendServiceStartChatProcedure,
		&frontendapi.StartChatRequest{
			Recipe: &frontendapi.StartChatRequest_RecipeId{
				RecipeId: "02JNMi0W1605TLxzQt6v",
			},
		},
	)

	s.AddSampleRequests(
		frontendapiconnect.FrontendServiceGenerateRecipeProcedure,
		&frontendapi.GenerateRecipeRequest{
			Prompt: "I have potatoes and onions in my fridge. I want a nice Japanese dish to cook.",
		},
	)

	s.AddSampleRequests(
		frontendapiconnect.FrontendServiceGeneratePlanProcedure,
		&frontendapi.GeneratePlanRequest{
			NumDays:     3,
			Ingredients: []string{"onions", "potatoes"},
			Genres: []frontendapi.RecipeGenre{
				frontendapi.RecipeGenre_RECIPE_GENRE_JAPANESE,
				frontendapi.RecipeGenre_RECIPE_GENRE_ITALIAN,
			},
		},
	)

	s.AddSampleRequests(
		frontendapiconnect.FrontendServiceGetChatMessagesProcedure,
		&frontendapi.GetChatMessagesRequest{},
	)

	s.AddSampleRequests(
		frontendapiconnect.FrontendServiceChatPlanProcedure,
		&frontendapi.ChatPlanRequest{
			Message: "Hello.",
			NewChat: true,
		},
		&frontendapi.ChatPlanRequest{
			Message: "こんにちは",
			NewChat: true,
		},
	)

	s.AddSampleRequests(
		frontendapiconnect.FrontendServiceUpdatePlanProcedure,
		&frontendapi.UpdatePlanRequest{},
	)

	s.AddSampleRequests(
		frontendapiconnect.FrontendServiceDeletePlanProcedure,
		&frontendapi.DeletePlanRequest{},
	)

	s.AddSampleRequests(
		frontendapiconnect.FrontendServiceGetPlansProcedure,
		&frontendapi.GetPlansRequest{},
	)

	s.AddSampleRequests(
		frontendapiconnect.FrontendServiceGetPlanProcedure,
		&frontendapi.GetPlanRequest{},
	)

	s.AddSampleRequests(
		frontendapiconnect.FrontendServiceAddRecipeProcedure,
		&frontendapi.AddRecipeRequest{
			Title:            "Test: 簡単・美味！トマトすき焼きパスタ",
			ServingSize:      "2人分",
			MainImageDataUrl: addRecipeStepImageURL,
			Ingredients: []*frontendapi.RecipeIngredient{
				{
					Name:     "パスタ",
					Quantity: "160~200g",
				},
				{
					Name:     "牛肉",
					Quantity: "150~200g",
				},
				{
					Name:     "ミニトマト",
					Quantity: "8~10個",
				},
				{
					Name:     "玉ねぎ",
					Quantity: "1/2個",
				},
				{
					Name:     "油（炒め用）",
					Quantity: "適量",
				},
			},
			AdditionalIngredients: []*frontendapi.IngredientSection{
				{
					Title: "割り下",
					Ingredients: []*frontendapi.RecipeIngredient{
						{
							Name:     "しょう油",
							Quantity: "大2~3",
						},
						{
							Name:     "みりん",
							Quantity: "大1.5~2",
						},
						{
							Name:     "砂糖",
							Quantity: "大1~1.5",
						},
						{
							Name:     "酒か水",
							Quantity: "大1~1.5",
						},
					},
				},
			},
			Steps: []*frontendapi.AddRecipeRequest_AddRecipeStep{
				{
					Description:  "材料を揃える。玉ねぎはくし切り、ミニトマトは半分に切っておく。割り下は混ぜておく。",
					ImageDataUrl: addRecipeStepImageURL,
				},
				{
					Description:  "材料を揃える。玉ねぎはくし切り、ミニトマトは半分に切っておく。割り下は混ぜておく。",
					ImageDataUrl: addRecipeStepImageURL,
				},
				{
					Description:  "材料を揃える。玉ねぎはくし切り、ミニトマトは半分に切っておく。割り下は混ぜておく。",
					ImageDataUrl: addRecipeStepImageURL,
				},
			},
		},
	)

	s.AddSampleRequests(
		frontendapiconnect.FrontendServiceAddBookmarkProcedure,
		&frontendapi.AddBookmarkRequest{
			RecipeId: "02JNMi0W1605TLxzQt6v",
		},
	)

	s.AddSampleRequests(
		frontendapiconnect.FrontendServiceRemoveBookmarkProcedure,
		&frontendapi.RemoveBookmarkRequest{
			RecipeId: "02JNMi0W1605TLxzQt6v",
		},
	)

	s.AddSampleRequests(
		frontendapiconnect.FrontendServiceGetUserProcedure,
		&frontendapi.GetUserRequest{},
	)

	s.AddSampleRequests(
		frontendapiconnect.FrontendServiceEditUserProcedure,
		&frontendapi.EditUserRequest{
			PlanPrompt: new("No seafood, have 3 stoves."),
		},
	)

	s.EnableDocsFirebaseAuth("alpha.coopii.app")

	if err := s.Start(ctx); err != nil {
		return fmt.Errorf("main: starting server: %w", err)
	}
	return nil
}
