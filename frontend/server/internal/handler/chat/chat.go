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
	sess := &chatSession{
		userStream: stream,
		grp:        parallel.ErrGroup(parallel.Unlimited(ctx)),
		genAI:      h.genAI,
		initChan:   make(chan struct{}),
	}
	return sess.run()
}

type chatSession struct {
	userStream *connect.BidiStream[frontendapi.ChatRequest, frontendapi.ChatResponse]
	grp        parallel.ErrGroupExecutor
	genAI      *genai.Client
	initChan   chan struct{}

	chatStream *genai.Session
}

func (s *chatSession) run() error {
	defer func() {
		if s.chatStream != nil {
			s.chatStream.Close()
		}
	}()
	s.grp.Go(s.receiveLoop)
	<-s.initChan
	return s.grp.Wait()
}

func (s *chatSession) receiveLoop(ctx context.Context) error {
	for {
		msg, err := s.userStream.Receive()
		if errors.Is(err, io.EOF) {
			return nil
		}
		if err != nil {
			return fmt.Errorf("chat: receiving message: %w", err)
		}

		if s.chatStream == nil {
			recipe := msg.GetRecipe()
			prompt := fmt.Sprintf(`You are a cooking assistant that helps a user work through a recipe. 
			Wait for the user to greet you before starting to talk to them. Start by acknowledging the recipe they are
			trying to cook and ask the when they are ready to begin. When they are ready, walk them through the recipe
			one step at a time, pausing after each step until the user says they are ready to continue. If the user
			asks any questions, answer them in a friendly and helpful manner.

			Always speak in Japanese. If the recipe is in another language, translate it and convey in Japanese.

			The recipe is as follows:\n%s\n\n
			`, recipe)
			chatStream, err := s.genAI.Live.Connect(ctx, "gemini-2.0-flash-exp", &genai.LiveConnectConfig{
				ResponseModalities: []genai.Modality{genai.ModalityAudio},
				SpeechConfig: &genai.SpeechConfig{
					LanguageCode: "ja-JP",
				},
				SystemInstruction: &genai.Content{
					Role: "model",
					Parts: []*genai.Part{
						{
							Text: prompt,
						},
					},
				},
			})
			if err != nil {
				return fmt.Errorf("chat: starting genai live session: %w", err)
			}
			s.chatStream = chatStream
			s.grp.Go(s.chatLoop)
			s.initChan <- struct{}{}
		}

		if p, ok := msg.GetContent().GetPayload().(*frontendapi.ChatContent_Audio); ok {
			if err := s.chatStream.SendRealtimeInput(genai.LiveRealtimeInput{
				Media: &genai.Blob{
					MIMEType: "audio/pcm",
					Data:     p.Audio,
				},
			}); err != nil {
				return fmt.Errorf("chat: sending audio to genai: %w", err)
			}
		}
	}
}

func (s *chatSession) chatLoop(_ context.Context) error {
	for {
		msg, err := s.chatStream.Receive()
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
				if err := s.userStream.Send(&frontendapi.ChatResponse{
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
