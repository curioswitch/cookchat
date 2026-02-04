// Copyright (c) CurioSwitch (choko@curioswitch.org)
// SPDX-License-Identifier: BUSL-1.1

package cookchatdb

import "time"

type ChatRole string

const (
	// ChatRoleUser represents a user message.
	ChatRoleUser ChatRole = "user"
	// ChatRoleAssistant represents an assistant message.
	ChatRoleAssistant ChatRole = "assistant"
)

// ChatMessage represents a message in a chat conversation.
type ChatMessage struct {
	// Role is the role of the message sender.
	Role ChatRole `firestore:"role"`

	// Content is the text content of the message.
	Content string `firestore:"content"`
}

type Chat struct {
	// ID is the unique identifier for the chat.
	ID string `firestore:"id"`

	// Messages is the list of messages in the chat.
	Messages []ChatMessage `firestore:"messages"`

	// PlanID is the ID of the plan created from the chat as a final result.
	PlanID string `firestore:"planId"`

	// CreatedAt is the timestamp when the chat was created.
	CreatedAt time.Time `firestore:"createdAt"`

	// UpdatedAt is the timestamp when the chat was last updated.
	UpdatedAt time.Time `firestore:"updatedAt"`
}
