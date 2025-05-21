package main

import (
	"context"
	"embed"
	"fmt"
	"io/fs"
	"log/slog"
	"net/http"
	"os"

	"cloud.google.com/go/storage"
	"connectrpc.com/connect"
	firebase "firebase.google.com/go/v4"
	"github.com/curioswitch/go-curiostack/otel"
	"github.com/curioswitch/go-curiostack/server"
	"github.com/gocolly/colly/v2"

	crawlerapi "github.com/curioswitch/cookchat/crawler/api/go"
	"github.com/curioswitch/cookchat/crawler/api/go/crawlerapiconnect"
	"github.com/curioswitch/cookchat/crawler/server/internal/config"
	"github.com/curioswitch/cookchat/crawler/server/internal/handler/cookpad/recipe"
	"github.com/curioswitch/cookchat/crawler/server/internal/handler/cookpad/user"
)

//go:embed conf/*.yaml
var confFiles embed.FS

func main() {
	conf, _ := fs.Sub(confFiles, "conf")
	os.Exit(server.Main(&config.Config{}, conf, setupServer))
}

func setupServer(ctx context.Context, conf *config.Config, s *server.Server) error {
	fbApp, err := firebase.NewApp(ctx, &firebase.Config{ProjectID: conf.Google.Project})
	if err != nil {
		return fmt.Errorf("main: create firebase app: %w", err)
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

	crawlerClient := crawlerapiconnect.NewCrawlerServiceClient(
		http.DefaultClient,
		conf.Services.Crawler,
		connect.WithInterceptors(otel.ConnectInterceptor()),
	)

	baseCollector := colly.NewCollector(
		colly.UserAgent("CurioBot/0.1"),
	)

	server.HandleConnectUnary(s,
		crawlerapiconnect.CrawlerServiceCrawlCookpadRecipeProcedure,
		recipe.NewHandler(baseCollector, firestore, storage, publicBucket).CrawlCookpadRecipe,
		[]*crawlerapi.CrawlCookpadRecipeRequest{
			{
				RecipeId: "24664122",
			},
		},
	)

	server.HandleConnectUnary(s,
		crawlerapiconnect.CrawlerServiceCrawlCookpadUserProcedure,
		user.NewHandler(baseCollector, crawlerClient).CrawlCookpadUser,
		[]*crawlerapi.CrawlCookpadUserRequest{
			{
				UserId: "40054625",
			},
		},
	)

	if err := server.Start(ctx, s); err != nil {
		return fmt.Errorf("main: start server: %w", err)
	}
	return nil
}
