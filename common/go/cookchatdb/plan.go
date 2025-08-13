// Copyright (c) CurioSwitch (choko@curioswitch.org)
// SPDX-License-Identifier: BUSL-1.1

package cookchatdb

import "time"

// Plan is the plan for a single day. Plans are stored in the
// plans collection for a user, with the ID YYYY-mm-dd.
type Plan struct {
	// Date is the date of the day.
	Date time.Time `firestore:"date"`

	// Recipes is the list of recipe IDs for the day.
	Recipes []string `firestore:"recipes"`
}
