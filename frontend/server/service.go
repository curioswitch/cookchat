// Copyright (c) CurioSwitch (choko@curioswitch.org)
// SPDX-License-Identifier: BUSL-1.1

package main

import (
	"context"

	frontendapi "github.com/curioswitch/cookchat/frontend/api/go"
	"github.com/curioswitch/cookchat/frontend/api/go/frontendapiconnect"
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
)

type frontendService struct {
	addBookmark     *addbookmark.Handler
	addRecipe       *addrecipe.Handler
	chatPlan        *chatplan.Handler
	deletePlan      *deleteplan.Handler
	editUser        *edituser.Handler
	generatePlan    *generateplan.Handler
	generateRecipe  *generaterecipe.Handler
	getChatMessages *getchatmessages.Handler
	getPlan         *getplan.Handler
	getPlans        *getplans.Handler
	getRecipe       *getrecipe.Handler
	getUser         *getuser.Handler
	listRecipes     *listrecipes.Handler
	removeBookmark  *removebookmark.Handler
	startChat       *startchat.Handler
	updatePlan      *updateplan.Handler
}

func newFrontendService(addBookmark *addbookmark.Handler,
	addRecipe *addrecipe.Handler,
	chatPlan *chatplan.Handler,
	deletePlan *deleteplan.Handler,
	editUser *edituser.Handler,
	generatePlan *generateplan.Handler,
	generateRecipe *generaterecipe.Handler,
	getChatMessages *getchatmessages.Handler,
	getPlan *getplan.Handler,
	getPlans *getplans.Handler,
	getRecipe *getrecipe.Handler,
	getUser *getuser.Handler,
	listRecipes *listrecipes.Handler,
	removeBookmark *removebookmark.Handler,
	startChat *startchat.Handler,
	updatePlan *updateplan.Handler,
) frontendapiconnect.FrontendServiceHandler {
	return &frontendService{
		addBookmark:     addBookmark,
		addRecipe:       addRecipe,
		chatPlan:        chatPlan,
		deletePlan:      deletePlan,
		editUser:        editUser,
		generatePlan:    generatePlan,
		generateRecipe:  generateRecipe,
		getChatMessages: getChatMessages,
		getPlan:         getPlan,
		getPlans:        getPlans,
		getRecipe:       getRecipe,
		getUser:         getUser,
		listRecipes:     listRecipes,
		removeBookmark:  removeBookmark,
		startChat:       startChat,
		updatePlan:      updatePlan,
	}
}

// AddBookmark implements [frontendapiconnect.FrontendServiceHandler].
func (f *frontendService) AddBookmark(ctx context.Context, req *frontendapi.AddBookmarkRequest) (*frontendapi.AddBookmarkResponse, error) {
	return f.addBookmark.AddBookmark(ctx, req)
}

// AddRecipe implements [frontendapiconnect.FrontendServiceHandler].
func (f *frontendService) AddRecipe(ctx context.Context, req *frontendapi.AddRecipeRequest) (*frontendapi.AddRecipeResponse, error) {
	return f.addRecipe.AddRecipe(ctx, req)
}

// ChatPlan implements [frontendapiconnect.FrontendServiceHandler].
func (f *frontendService) ChatPlan(ctx context.Context, req *frontendapi.ChatPlanRequest) (*frontendapi.ChatPlanResponse, error) {
	return f.chatPlan.ChatPlan(ctx, req)
}

// DeletePlan implements [frontendapiconnect.FrontendServiceHandler].
func (f *frontendService) DeletePlan(ctx context.Context, req *frontendapi.DeletePlanRequest) (*frontendapi.DeletePlanResponse, error) {
	return f.deletePlan.DeletePlan(ctx, req)
}

// EditUser implements [frontendapiconnect.FrontendServiceHandler].
func (f *frontendService) EditUser(ctx context.Context, req *frontendapi.EditUserRequest) (*frontendapi.EditUserResponse, error) {
	return f.editUser.EditUser(ctx, req)
}

// GeneratePlan implements [frontendapiconnect.FrontendServiceHandler].
func (f *frontendService) GeneratePlan(ctx context.Context, req *frontendapi.GeneratePlanRequest) (*frontendapi.GeneratePlanResponse, error) {
	return f.generatePlan.GeneratePlan(ctx, req)
}

// GenerateRecipe implements [frontendapiconnect.FrontendServiceHandler].
func (f *frontendService) GenerateRecipe(ctx context.Context, req *frontendapi.GenerateRecipeRequest) (*frontendapi.GenerateRecipeResponse, error) {
	return f.generateRecipe.GenerateRecipe(ctx, req)
}

// GetChatMessages implements [frontendapiconnect.FrontendServiceHandler].
func (f *frontendService) GetChatMessages(ctx context.Context, req *frontendapi.GetChatMessagesRequest) (*frontendapi.GetChatMessagesResponse, error) {
	return f.getChatMessages.GetChatMessages(ctx, req)
}

// GetPlan implements [frontendapiconnect.FrontendServiceHandler].
func (f *frontendService) GetPlan(ctx context.Context, req *frontendapi.GetPlanRequest) (*frontendapi.GetPlanResponse, error) {
	return f.getPlan.GetPlan(ctx, req)
}

// GetPlans implements [frontendapiconnect.FrontendServiceHandler].
func (f *frontendService) GetPlans(ctx context.Context, req *frontendapi.GetPlansRequest) (*frontendapi.GetPlansResponse, error) {
	return f.getPlans.GetPlans(ctx, req)
}

// GetRecipe implements [frontendapiconnect.FrontendServiceHandler].
func (f *frontendService) GetRecipe(ctx context.Context, req *frontendapi.GetRecipeRequest) (*frontendapi.GetRecipeResponse, error) {
	return f.getRecipe.GetRecipe(ctx, req)
}

// GetUser implements [frontendapiconnect.FrontendServiceHandler].
func (f *frontendService) GetUser(ctx context.Context, req *frontendapi.GetUserRequest) (*frontendapi.GetUserResponse, error) {
	return f.getUser.GetUser(ctx, req)
}

// ListRecipes implements [frontendapiconnect.FrontendServiceHandler].
func (f *frontendService) ListRecipes(ctx context.Context, req *frontendapi.ListRecipesRequest) (*frontendapi.ListRecipesResponse, error) {
	return f.listRecipes.ListRecipes(ctx, req)
}

// RemoveBookmark implements [frontendapiconnect.FrontendServiceHandler].
func (f *frontendService) RemoveBookmark(ctx context.Context, req *frontendapi.RemoveBookmarkRequest) (*frontendapi.RemoveBookmarkResponse, error) {
	return f.removeBookmark.RemoveBookmark(ctx, req)
}

// StartChat implements [frontendapiconnect.FrontendServiceHandler].
func (f *frontendService) StartChat(ctx context.Context, req *frontendapi.StartChatRequest) (*frontendapi.StartChatResponse, error) {
	return f.startChat.StartChat(ctx, req)
}

// UpdatePlan implements [frontendapiconnect.FrontendServiceHandler].
func (f *frontendService) UpdatePlan(ctx context.Context, req *frontendapi.UpdatePlanRequest) (*frontendapi.UpdatePlanResponse, error) {
	return f.updatePlan.UpdatePlan(ctx, req)
}

var _ frontendapiconnect.FrontendServiceHandler = (*frontendService)(nil)
