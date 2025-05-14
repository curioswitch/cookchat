// Copyright (c) Choko (choko@curioswitch.org)
// SPDX-License-Identifier: BUSL-1.1

package main

import (
	"context"
	"embed"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"strings"

	"connectrpc.com/connect"
	firebase "firebase.google.com/go/v4"
	"github.com/curioswitch/go-curiostack/server"
	"github.com/curioswitch/go-usegcp/middleware/firebaseauth"
	"github.com/curioswitch/wshttp"
	"google.golang.org/genai"

	frontendapi "github.com/curioswitch/cookchat/frontend/api/go"
	"github.com/curioswitch/cookchat/frontend/api/go/frontendapiconnect"
	"github.com/curioswitch/cookchat/frontend/server/internal/config"
	"github.com/curioswitch/cookchat/frontend/server/internal/handler/chat"
	"github.com/curioswitch/cookchat/frontend/server/internal/handler/listrecipes"
)

var confFiles embed.FS // Currently empty

func main() {
	os.Exit(server.Main(&config.Config{}, confFiles, setupServer))
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

	genAI, err := genai.NewClient(ctx, &genai.ClientConfig{
		Backend:  genai.BackendVertexAI,
		Project:  conf.Google.Project,
		Location: "us-central1",
	})
	if err != nil {
		return fmt.Errorf("creating genai client: %w", err)
	}

	chat := chat.NewHandler(genAI)
	chatServiceMethods := frontendapi.File_frontendapi_frontend_proto.Services().ByName("ChatService").Methods()
	chatHandler := connect.NewBidiStreamHandler(
		frontendapiconnect.ChatServiceChatProcedure,
		chat.Chat,
		connect.WithSchema(chatServiceMethods.ByName("Chat")),
	)

	fbMW := firebaseauth.NewMiddleware(fbAuth)
	requireCurio := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			tok := firebaseauth.TokenFromContext(r.Context())
			if id, ok := tok.Firebase.Identities["email"]; ok {
				if idAny, ok := id.([]any); ok && len(idAny) > 0 {
					if email, ok := idAny[0].(string); ok {
						if strings.HasSuffix(email, "@curioswitch.org") {
							next.ServeHTTP(w, r)
							return
						}
					}
				}
			}
			http.Error(w, "permission denied", http.StatusForbidden)
		})
	}
	mux.Handle("/frontendapi.ChatService/Chat", wshttp.WrapHandler(fbMW(requireCurio(chatHandler))))

	server.HandleConnectUnary(s,
		frontendapiconnect.FrontendServiceListRecipesProcedure,
		listrecipes.NewHandler(firestore).ListRecipes,
		[]*frontendapi.ListRecipesRequest{
			{},
		},
	)

	server.EnableDocsFirebaseAuth(s, "alpha.cookchat.curioswitch.org")

	if err := server.Start(ctx, s); err != nil {
		return fmt.Errorf("main: starting server: %w", err)
	}
	return nil
}
