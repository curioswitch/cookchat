// Copyright (c) CurioSwitch (choko@curioswitch.org)
// SPDX-License-Identifier: BUSL-1.1

package main

import (
	"context"

	tasksapi "github.com/curioswitch/cookchat/tasks/api/go"
	"github.com/curioswitch/cookchat/tasks/api/go/tasksapiconnect"
	"github.com/curioswitch/cookchat/tasks/server/internal/handler/fillplan"
)

type tasksService struct {
	fillPlan *fillplan.Handler
}

func newTasksService(fillPlan *fillplan.Handler) tasksapiconnect.TasksServiceHandler {
	return &tasksService{
		fillPlan: fillPlan,
	}
}

// FillPlan implements [tasksapiconnect.TasksServiceHandler].
func (s *tasksService) FillPlan(ctx context.Context, req *tasksapi.FillPlanRequest) (*tasksapi.FillPlanResponse, error) {
	return s.fillPlan.FillPlan(ctx, req)
}

var _ tasksapiconnect.TasksServiceHandler = (*tasksService)(nil)
