// Copyright (c) Choko (choko@curioswitch.org)
// SPDX-License-Identifier: BUSL-1.1

package chat

import (
	"context"
	"errors"
	"fmt"
	"io"

	"connectrpc.com/connect"
	"github.com/wandb/parallel"
	"google.golang.org/genai"

	frontendapi "github.com/curioswitch/cookchat/frontend/api/go"
)

// NewHandler returns a Handler.
func NewHandler(genAI *genai.Client) *Handler {
	return &Handler{
		genAI: genAI,
	}
}

// Handler handles chat streams.
type Handler struct {
	genAI *genai.Client
}

func (h *Handler) Chat(ctx context.Context, stream *connect.BidiStream[frontendapi.ChatRequest, frontendapi.ChatResponse]) error {
	sess, err := h.genAI.Live.Connect("gemini-2.0-flash", &genai.LiveConnectConfig{
		ResponseModalities: []genai.Modality{genai.ModalityAudio},
		SystemInstruction: &genai.Content{
			Role: "model",
			Parts: []*genai.Part{
				{
					Text: "You are a friend.",
				},
			},
		},
	})
	if err != nil {
		return fmt.Errorf("chat: starting genai live session: %w", err)
	}
	defer sess.Close()

	grp := parallel.ErrGroup(parallel.Unlimited(ctx))
	grp.Go(func(_ context.Context) error {
		defer sess.Close()
		for {
			msg, err := stream.Receive()
			if errors.Is(err, io.EOF) {
				return nil
			}
			if err != nil {
				return fmt.Errorf("chat: receiving message: %w", err)
			}
			if p, ok := msg.GetContent().GetPayload().(*frontendapi.ChatContent_Audio); ok {
				if err := sess.Send(&genai.LiveClientMessage{
					RealtimeInput: &genai.LiveClientRealtimeInput{
						MediaChunks: []*genai.Blob{
							{
								MIMEType: "audio/pcm",
								Data:     p.Audio,
							},
						},
					},
				}); err != nil {
					return fmt.Errorf("chat: sending audio to genai: %w", err)
				}
			}
		}
	})

	for {
		msg, err := sess.Receive()
		if err != nil {
			return fmt.Errorf("chat: receiving message from genai: %w", err)
		}
		if msg.ServerContent != nil && msg.ServerContent.ModelTurn != nil {
			for _, p := range msg.ServerContent.ModelTurn.Parts {
				if p.InlineData == nil {
					continue
				}
				if p.InlineData.MIMEType != "audio/pcm" {
					continue
				}
				if err := stream.Send(&frontendapi.ChatResponse{
					Content: &frontendapi.ChatContent{
						Payload: &frontendapi.ChatContent_Audio{
							Audio: p.InlineData.Data,
						},
					},
				}); err != nil {
					return fmt.Errorf("chat: sending response to client: %w", err)
				}
			}
		}
	}
}
