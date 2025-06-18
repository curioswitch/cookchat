// Copyright (c) Choko (choko@curioswitch.org)
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

	discoveryengine "cloud.google.com/go/discoveryengine/apiv1"
	"connectrpc.com/connect"
	firebase "firebase.google.com/go/v4"
	"github.com/curioswitch/go-curiostack/server"
	"github.com/curioswitch/go-usegcp/middleware/firebaseauth"
	"github.com/curioswitch/wshttp"
	"github.com/go-chi/chi/v5/middleware"
	"google.golang.org/genai"

	frontendapi "github.com/curioswitch/cookchat/frontend/api/go"
	"github.com/curioswitch/cookchat/frontend/api/go/frontendapiconnect"
	"github.com/curioswitch/cookchat/frontend/server/internal/config"
	"github.com/curioswitch/cookchat/frontend/server/internal/handler/chat"
	"github.com/curioswitch/cookchat/frontend/server/internal/handler/getrecipe"
	"github.com/curioswitch/cookchat/frontend/server/internal/handler/listrecipes"
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

	chat := chat.NewHandler(genAI, firestore)
	chatServiceMethods := frontendapi.File_frontendapi_frontend_proto.Services().ByName("ChatService").Methods()
	chatHandler := connect.NewBidiStreamHandler(
		frontendapiconnect.ChatServiceChatProcedure,
		chat.Chat,
		connect.WithSchema(chatServiceMethods.ByName("Chat")),
	)

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
		case strings.HasPrefix(r.URL.Path, "/frontendapi.ChatService/Chat"):
			// Websocket won't have Authorization header at HTTP level so we set the middleware
			// ourselves after wshttp.
			return false
		case strings.HasPrefix(r.URL.Path, "/internal/"):
			return false
		default:
			return true
		}
	}))

	mux.Handle("/frontendapi.ChatService/Chat", wshttp.WrapHandler(fbMW(requireAccess(chatHandler))))

	server.HandleConnectUnary(s,
		frontendapiconnect.FrontendServiceGetRecipeProcedure,
		getrecipe.NewHandler(firestore).GetRecipe,
		[]*frontendapi.GetRecipeRequest{
			{
				RecipeId: "02JNMi0W1605TLxzQt6v",
			},
		},
	)

	server.HandleConnectUnary(s,
		frontendapiconnect.FrontendServiceListRecipesProcedure,
		listrecipes.NewHandler(firestore, search, conf.Search.Engine).ListRecipes,
		[]*frontendapi.ListRecipesRequest{
			{},
			{
				Query: "玉ねぎ",
			},
		},
	)

	server.EnableDocsFirebaseAuth(s, "alpha.cookchat.curioswitch.org")

	if err := server.Start(ctx, s); err != nil {
		return fmt.Errorf("main: starting server: %w", err)
	}
	return nil
}
