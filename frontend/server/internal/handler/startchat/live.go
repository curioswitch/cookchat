// Copyright (c) CurioSwitch (choko@curioswitch.org)
// SPDX-License-Identifier: BUSL-1.1

package startchat

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"connectrpc.com/connect"
	"github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/live"
	"github.com/openai/openai-go/v3/option"

	frontendapi "github.com/curioswitch/cookchat/frontend/api/go"
	"github.com/curioswitch/cookchat/frontend/server/internal/i18n"
)

// Session configuration stays on the server. The browser adapter only owns media
// transport and executes the same navigation callbacks as the Realtime SDK.
func (h *Handler) startChatLive(ctx context.Context, req *frontendapi.StartChatRequest, prompt string) (*frontendapi.StartChatResponse, error) {
	if strings.TrimSpace(req.GetSdpOffer()) == "" || len(req.GetSdpOffer()) > 64*1024 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("startchat: Live requires a WebRTC offer of at most 64 KiB"))
	}
	language := "Japanese"
	if i18n.UserLanguage(ctx) == "en" {
		language = "English"
	}
	res, err := h.openai.Live.New(ctx, live.LiveNewParams{
		Session: live.MediaSessionConfigParam{
			Model: live.MediaSessionConfigModelGPTLive1,
			Client: live.ClientConfigParam{DataChannel: live.DataChannelConfigParam{
				AllowedClientEvents: live.DataChannelConfigAllowedClientEventsUnionParam{
					OfArrayOfStrings: []string{"response.item.create", "response.create", "session.close"},
				},
			}},
			Instructions: openai.String(fmt.Sprintf(`You are COOPii, a friendly, patient cooking assistant. Speak %s, naturally and concisely.
The backend already has the user's recipe or cooking plan. Delegate all recipe questions, serving adjustments, and recipe navigation to it, including next, back, repeat, and ingredients requests.
Before reading a step or ingredients aloud, wait for the backend to confirm navigation and supply the exact content. Do not invent recipe details or move to another step without the user's request.
Read only the requested step, then wait for the user. Never say tool names. Listen to interruptions and follow the user's latest request.`, language)),
			Audio: live.MediaSessionConfigAudioParam{Output: live.MediaSessionConfigAudioOutputParam{
				Voice: live.MediaSessionConfigAudioOutputVoiceUnionParam{OfString: openai.String("marin")},
			}},
			Input: []live.InitialItemUnionParam{live.InitialItemParamOfDeveloper([]live.InitialItemDeveloperContentParam{{
				Type: "input_text", Text: fmt.Sprintf("Begin the conversation in %s as soon as the opening backend response arrives, before the caller speaks. The application requests this opening response at startup; do not request a duplicate. Greet the caller, read the recipe title supplied by the backend, ask how many people they are cooking for, then pause and listen.", language),
			}})},
			Delegation: live.MediaSessionConfigDelegationUnionParam{OfResponses: &live.MediaSessionConfigDelegationResponsesParam{
				Responses: live.ResponsesDelegationConfigParam{
					Model: "gpt-6-luna",
					Instructions: openai.String(prompt + `

# Live voice backend
You are the backend for a spoken cooking conversation. Follow the cooking workflow above; return concise guidance and exact recipe content for the voice assistant to say, rather than speaking directly yourself.
Keep track of the current step and serving size using conversation context. Voice transcripts may include interruptions and corrections; follow the latest request.
Before returning a step or ingredients to be read aloud, call the corresponding navigation tool and wait for its successful result. Return only the requested step and ask the user when they are ready to move on.
For the opening request, return the recipe title and a question about how many people the user is cooking for. Do not read ingredients or steps yet.`),
					ParallelToolCalls: openai.Bool(false),
					Tools: []live.ResponsesDelegationConfigToolUnionParam{
						{OfFunction: &live.FunctionToolParam{
							Name: "navigate_to_step", Description: openai.String("Call before returning any step to be read aloud. Navigate to the requested step using a 1-based index."), Strict: openai.Bool(true),
							Parameters: map[string]any{"type": "object", "properties": map[string]any{"step": map[string]any{"type": "integer", "minimum": 1}}, "required": []string{"step"}, "additionalProperties": false},
						}},
						{OfFunction: &live.FunctionToolParam{
							Name: "navigate_to_ingredients", Description: openai.String("Call before returning ingredients to be read aloud."), Strict: openai.Bool(true),
							Parameters: map[string]any{"type": "object", "properties": map[string]any{}, "required": []string{}, "additionalProperties": false},
						}},
					},
				},
			}},
		},
		Transport: live.LiveNewParamsTransport{Sdp: req.GetSdpOffer()},
	}, option.WithMaxRetries(0)) // A retried offer could create a second billable session.
	if err != nil {
		return nil, fmt.Errorf("startchat: creating OpenAI Live session: %w", err)
	}
	return &frontendapi.StartChatResponse{ChatModel: "gpt-live-1", SdpAnswer: res.Transport.Sdp, SessionId: res.Session.ID}, nil
}
