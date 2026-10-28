// Copyright (c) CurioSwitch (choko@curioswitch.org)
// SPDX-License-Identifier: BUSL-1.1

package main

import (
	"context"

	crawlerapi "github.com/curioswitch/cookchat/crawler/api/go"
	"github.com/curioswitch/cookchat/crawler/api/go/crawlerapiconnect"
	cookpadrecipe "github.com/curioswitch/cookchat/crawler/server/internal/handler/cookpad/recipe"
	"github.com/curioswitch/cookchat/crawler/server/internal/handler/cookpad/user"
	"github.com/curioswitch/cookchat/crawler/server/internal/handler/recipe"
)

type crawlerService struct {
	crawlRecipe        *recipe.Handler
	crawlCookpadRecipe *cookpadrecipe.Handler
	crawlCookpadUser   *user.Handler
}

func newCrawlerService(crawlRecipe *recipe.Handler, crawlCookpadRecipe *cookpadrecipe.Handler, crawlCookpadUser *user.Handler) crawlerapiconnect.CrawlerServiceHandler {
	return &crawlerService{
		crawlRecipe:        crawlRecipe,
		crawlCookpadRecipe: crawlCookpadRecipe,
		crawlCookpadUser:   crawlCookpadUser,
	}
}

// CrawlRecipe implements [crawlerapiconnect.CrawlerServiceHandler].
func (s *crawlerService) CrawlRecipe(ctx context.Context, req *crawlerapi.CrawlRecipeRequest) (*crawlerapi.CrawlRecipeResponse, error) {
	return s.crawlRecipe.CrawlRecipe(ctx, req)
}

// CrawlCookpadRecipe implements [crawlerapiconnect.CrawlerServiceHandler].
func (s *crawlerService) CrawlCookpadRecipe(ctx context.Context, req *crawlerapi.CrawlCookpadRecipeRequest) (*crawlerapi.CrawlCookpadRecipeResponse, error) {
	return s.crawlCookpadRecipe.CrawlCookpadRecipe(ctx, req)
}

// CrawlCookpadUser implements [crawlerapiconnect.CrawlerServiceHandler].
func (s *crawlerService) CrawlCookpadUser(ctx context.Context, req *crawlerapi.CrawlCookpadUserRequest) (*crawlerapi.CrawlCookpadUserResponse, error) {
	return s.crawlCookpadUser.CrawlCookpadUser(ctx, req)
}

var _ crawlerapiconnect.CrawlerServiceHandler = (*crawlerService)(nil)
