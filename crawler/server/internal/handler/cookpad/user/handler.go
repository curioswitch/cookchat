package user

import (
	"context"
	"fmt"
	"strings"

	"connectrpc.com/connect"
	"github.com/gocolly/colly/v2"

	crawlerapi "github.com/curioswitch/cookchat/crawler/api/go"
	"github.com/curioswitch/cookchat/crawler/api/go/crawlerapiconnect"
)

func NewHandler(baseCollector *colly.Collector, crawlerClient crawlerapiconnect.CrawlerServiceClient) *Handler {
	return &Handler{
		baseCollector: baseCollector,
		crawlerClient: crawlerClient,
	}
}

type Handler struct {
	baseCollector *colly.Collector
	crawlerClient crawlerapiconnect.CrawlerServiceClient
}

func (h *Handler) CrawlCookpadUser(ctx context.Context, req *crawlerapi.CrawlCookpadUserRequest) (*crawlerapi.CrawlCookpadUserResponse, error) {
	// Avoid clone since we don't want to share storage.
	c := colly.NewCollector(
		colly.UserAgent(h.baseCollector.UserAgent),
		colly.StdlibContext(ctx),
	)

	c.OnHTML(`a[href^="/jp/recipes/"]`, func(e *colly.HTMLElement) {
		href := strings.TrimPrefix(e.Attr("href"), "/jp/recipes/")
		id, _, ok := strings.Cut(href, "-")
		if !ok {
			return
		}
		if _, err := h.crawlerClient.CrawlCookpadRecipe(ctx, connect.NewRequest(&crawlerapi.CrawlCookpadRecipeRequest{
			RecipeId: id,
		})); err != nil {
			// TODO: Log error
			return
		}
	})

	c.OnHTML(fmt.Sprintf(`a[href^="/jp/users/%s/recipes?page="]`, req.GetUserId()), func(e *colly.HTMLElement) {
		if err := c.Visit(e.Request.AbsoluteURL(e.Attr("href"))); err != nil {
			// TODO: Log error
		}
	})

	if err := c.Visit(fmt.Sprintf("https://cookpad.com/jp/users/%s/recipes", req.GetUserId())); err != nil {
		return nil, fmt.Errorf("cookpad:user: crawl user page: %w", err)
	}

	return &crawlerapi.CrawlCookpadUserResponse{}, nil
}
