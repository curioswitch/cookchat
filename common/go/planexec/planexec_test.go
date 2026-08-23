// Copyright (c) CurioSwitch (choko@curioswitch.org)
// SPDX-License-Identifier: BUSL-1.1

package planexec

import (
	"reflect"
	"testing"

	"github.com/curioswitch/cookchat/common/cookchatdb"
)

func TestResolveStepGroupsKeepsDescriptionsPairedWithImages(t *testing.T) {
	t.Parallel()

	recipes := []cookchatdb.Recipe{
		{
			ID: "main",
			Content: cookchatdb.RecipeContent{
				Steps: []cookchatdb.RecipeStep{
					{Description: "玉ねぎを切る。"},
					{Description: "玉ねぎを炒める。"},
				},
			},
			StepImageURLs: []string{"main-step-0.jpg", "main-step-1.jpg"},
		},
		{
			ID: "side",
			Content: cookchatdb.RecipeContent{
				Steps: []cookchatdb.RecipeStep{
					{Description: "きゅうりを塩もみする。", ImageURL: "side-step-0.jpg"},
				},
			},
		},
	}
	groups := []GeneratedStepGroup{
		{
			Label: "準備",
			Steps: []StepReference{
				{RecipeID: "side", StepIndex: 0},
				{RecipeID: "main", StepIndex: 1},
			},
			Note: "同時に進める。",
		},
	}

	got, err := ResolveStepGroups(groups, recipes)
	if err != nil {
		t.Fatalf("ResolveStepGroups() error = %v", err)
	}
	want := []cookchatdb.StepGroup{
		{
			Label: "準備",
			Steps: []cookchatdb.RecipeStep{
				{Description: "きゅうりを塩もみする。", ImageURL: "side-step-0.jpg"},
				{Description: "玉ねぎを炒める。", ImageURL: "main-step-1.jpg"},
			},
			Note: "同時に進める。",
		},
	}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("ResolveStepGroups() = %#v, want %#v", got, want)
	}
}

func TestResolveStepGroupsRejectsInvalidReferences(t *testing.T) {
	t.Parallel()

	recipes := []cookchatdb.Recipe{
		{
			ID: "main",
			Content: cookchatdb.RecipeContent{
				Steps: []cookchatdb.RecipeStep{{Description: "切る。"}},
			},
		},
	}
	tests := map[string][]StepReference{
		"unknown recipe": {
			{RecipeID: "missing", StepIndex: 0},
		},
		"out of range step": {
			{RecipeID: "main", StepIndex: 1},
		},
		"duplicate step": {
			{RecipeID: "main", StepIndex: 0},
			{RecipeID: "main", StepIndex: 0},
		},
	}

	for name, steps := range tests {
		t.Run(name, func(t *testing.T) {
			t.Parallel()
			_, err := ResolveStepGroups([]GeneratedStepGroup{{Steps: steps}}, recipes)
			if err == nil {
				t.Fatal("ResolveStepGroups() error = nil, want an invalid reference error")
			}
		})
	}
}
