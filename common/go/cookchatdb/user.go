// Copyright (c) CurioSwitch (choko@curioswitch.org)
// SPDX-License-Identifier: BUSL-1.1

package cookchatdb

// User is information about a user of the application.
type User struct {
	// ID is the firebase user ID of the user.
	ID string `firestore:"id"`

	// PlanPrompt is a shared prompt to use when planning.
	PlanPrompt string `firestore:"planPrompt"`
}
