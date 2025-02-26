// Copyright (c) Choko (choko@curioswitch.org)
// SPDX-License-Identifier: BUSL-1.1

package main

import (
	"context"
	"embed"
	"fmt"
	"os"

	"connectrpc.com/connect"
	"github.com/curioswitch/go-curiostack/server"
	"github.com/curioswitch/wshttp"
	"google.golang.org/genai"

	frontendapi "github.com/curioswitch/cookchat/frontend/api/go"
	"github.com/curioswitch/cookchat/frontend/api/go/frontendapiconnect"
	"github.com/curioswitch/cookchat/frontend/server/internal/config"
	"github.com/curioswitch/cookchat/frontend/server/internal/handler/chat"
)

var confFiles embed.FS // Currently empty

func main() {
	os.Exit(server.Main(&config.Config{}, confFiles, setupServer))
}

func setupServer(ctx context.Context, conf *config.Config, s *server.Server) error {
	mux := server.Mux(s)

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
	mux.Handle("/frontendapi.ChatService/Chat", wshttp.WrapHandler(chatHandler))

	return server.Start(ctx, s)
}
