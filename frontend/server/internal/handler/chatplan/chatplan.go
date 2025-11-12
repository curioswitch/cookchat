// Copyright (c) CurioSwitch (choko@curioswitch.org)
// SPDX-License-Identifier: BUSL-1.1

package chatplan

import (
	"context"
	"fmt"

	discoveryengine "cloud.google.com/go/discoveryengine/apiv1"
	"cloud.google.com/go/firestore"
	"google.golang.org/genai"

	frontendapi "github.com/curioswitch/cookchat/frontend/api/go"
	"github.com/curioswitch/cookchat/frontend/server/internal/llm"
)

func NewHandler(genAI *genai.Client, store *firestore.Client, search *discoveryengine.SearchClient) *Handler {
	return &Handler{
		genAI:  genAI,
		store:  store,
		search: search,
	}
}

type Handler struct {
	genAI  *genai.Client
	store  *firestore.Client
	search *discoveryengine.SearchClient
}

func (h *Handler) ChatPlan(ctx context.Context, req *frontendapi.ChatPlanRequest) (*frontendapi.ChatPlanResponse, error) {
	content := make([]*genai.Content, len(req.GetMessages()))
	for i, message := range req.GetMessages() {
		role := genai.Role(genai.RoleUser)
		if message.GetRole() == frontendapi.ChatMessage_ROLE_ASSISTANT {
			role = genai.RoleModel
		}
		content[i] = genai.NewContentFromText(message.GetContent(), role)
	}

	res, err := h.genAI.Models.GenerateContent(ctx, "gemini-2.5-flash", content, &genai.GenerateContentConfig{
		SystemInstruction: genai.NewContentFromText(llm.ChatPlanPrompt(), genai.RoleModel),
		Tools: []*genai.Tool{
			{
				GoogleSearch: &genai.GoogleSearch{},
			},
		},
	})
	if err != nil {
		return nil, fmt.Errorf("chatplan: calling GenerateContent for plan: %w", err)
	}
	if len(res.Candidates) != 1 || len(res.Candidates[0].Content.Parts) != 1 || res.Candidates[0].Content.Parts[0].Text == "" {
		return nil, fmt.Errorf("chatplan: unexpected response from generate ai for plan: %v", res)
	}

	messages := append([]*frontendapi.ChatMessage{}, req.GetMessages()...)
	message := &frontendapi.ChatMessage{
		Role:    frontendapi.ChatMessage_ROLE_ASSISTANT,
		Content: res.Candidates[0].Content.Parts[0].Text,
	}
	if cm := res.Candidates[0].CitationMetadata; cm != nil {
		for _, citation := range cm.Citations {
			if u := citation.URI; u != "" {
				message.Urls = append(message.Urls, u)
			}
		}
	}
	if gm := res.Candidates[0].GroundingMetadata; gm != nil {
		for _, g := range gm.GroundingChunks {
			if w := g.Web; w != nil {
				if u := w.URI; u != "" {
					message.Urls = append(message.Urls, u)
				}
			}
		}
	}
	messages = append(messages, message)

	return &frontendapi.ChatPlanResponse{
		Messages: messages,
	}, nil
}
