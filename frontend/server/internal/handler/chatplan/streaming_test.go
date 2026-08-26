// Copyright (c) CurioSwitch (choko@curioswitch.org)
// SPDX-License-Identifier: BUSL-1.1

package chatplan

import "testing"

func TestVisibleStreamingContent(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		text string
		want string
	}{
		{
			name: "shows a normal answer as it arrives",
			text: "2日分の献立ですね。",
			want: "2日分の献立ですね。",
		},
		{
			name: "waits while the control prefix is still ambiguous",
			text: "GENERATED MEAL",
			want: "",
		},
		{
			name: "never exposes generated plan JSON",
			text: "GENERATED MEAL PLAN\n[[{\"title\":\"カレー\"}]]",
			want: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := visibleStreamingContent(tt.text); got != tt.want {
				t.Fatalf("visibleStreamingContent(%q) = %q, want %q", tt.text, got, tt.want)
			}
		})
	}
}
