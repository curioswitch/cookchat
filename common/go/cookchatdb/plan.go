// Copyright (c) CurioSwitch (choko@curioswitch.org)
// SPDX-License-Identifier: BUSL-1.1

package cookchatdb

import "time"

// A group of steps to execute together.
type StepGroup struct {
	// A label for the step group.
	Label string `firestore:"label"`

	// The steps in the group.
	Steps []RecipeStep `firestore:"steps"`

	// A note about the steps.
	Note string `firestore:"note"`
}

type PlanStatus string

const (
	PlanStatusProcessing PlanStatus = "processing"
	PlanStatusActive     PlanStatus = "active"
)

// Plan is the plan for a single day. Plans are stored in the
// plans collection for a user, with the ID YYYY-mm-dd.
type Plan struct {
	// The ID of the plan.
	ID string `firestore:"id"`

	// Recipes is the list of recipe IDs for the day.
	Recipes []string `firestore:"recipes"`

	// The groups of steps to execute in the plan.
	StepGroups []StepGroup `firestore:"stepGroups"`

	// Any notes about the plan.
	Notes []string `firestore:"notes"`

	// The time the plan was created.
	CreatedAt time.Time `firestore:"createdAt"`

	// Status of the plan.
	Status PlanStatus `firestore:"status"`
}
