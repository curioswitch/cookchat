// Copyright (c) Choko (choko@curioswitch.org)
// SPDX-License-Identifier: BUSL-1.1

package chat

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"sync/atomic"

	"cloud.google.com/go/firestore"
	"connectrpc.com/connect"
	"github.com/wandb/parallel"
	"google.golang.org/api/iterator"
	"google.golang.org/genai"

	frontendapi "github.com/curioswitch/cookchat/frontend/api/go"
)

// NewHandler returns a Handler.
func NewHandler(genAI *genai.Client, store *firestore.Client) *Handler {
	return &Handler{
		genAI: genAI,
		store: store,
	}
}

// Handler handles chat streams.
type Handler struct {
	genAI *genai.Client
	store *firestore.Client
}

func (h *Handler) Chat(ctx context.Context, stream *connect.BidiStream[frontendapi.ChatRequest, frontendapi.ChatResponse]) error {
	sess := &chatSession{
		userStream: stream,
		grp:        parallel.ErrGroup(parallel.Unlimited(ctx)),
		genAI:      h.genAI,
		store:      h.store,
		initChan:   make(chan struct{}),
	}
	if err := sess.run(); err != nil {
		slog.ErrorContext(ctx, "chat: error in chat session", "error", err)
		return err
	}
	return nil
}

type chatSession struct {
	userStream *connect.BidiStream[frontendapi.ChatRequest, frontendapi.ChatResponse]
	grp        parallel.ErrGroupExecutor
	genAI      *genai.Client
	store      *firestore.Client
	initChan   chan struct{}

	chatStream       *genai.Session
	chatStreamClosed atomic.Bool
}

func (s *chatSession) run() error {
	defer s.closeChatStream()
	s.grp.Go(s.receiveLoop)
	<-s.initChan
	if err := s.grp.Wait(); err != nil {
		return fmt.Errorf("chat: error in chat session: %w", err)
	}
	return nil
}

func (s *chatSession) receiveLoop(ctx context.Context) error {
	defer s.closeChatStream()

	for {
		msg, err := s.userStream.Receive()
		if errors.Is(err, io.EOF) {
			return nil
		}
		if err != nil {
			return fmt.Errorf("chat: receiving message: %w", err)
		}

		if s.chatStream == nil {
			recipePrompt := ""
			if r := msg.GetRecipeText(); r != "" {
				recipePrompt = "The recipe is as follows:\n" + r
			} else if rid := msg.GetRecipeId(); rid != "" {
				recipeDoc, err := s.store.Collection("recipes").Where("id", "==", rid).Limit(1).Documents(ctx).Next()
				if err != nil {
					if errors.Is(err, iterator.Done) {
						return connect.NewError(connect.CodeNotFound, fmt.Errorf("chat: recipe not found: %w", err))
					}
					return fmt.Errorf("chat: getting recipe from firestore: %w", err)
				}
				recipeJSON, err := json.Marshal(recipeDoc.Data())
				if err != nil {
					return fmt.Errorf("chat: marshalling recipe to JSON: %w", err)
				}
				recipePrompt = "The recipe in structured JSON format is as follows:\n" + string(recipeJSON)
			}

			prompt := fmt.Sprintf(`You are a cooking assistant that helps a user work through a recipe. 
			Start by greeting the user and acknowleding the recipe they are trying to cook. Then ask them how many
			people they are preparing for. When they answer, list out the required ingredients for the specified number
			of people. Divide or multiply the numbers in the recipe if the number of people doesn't match the recipe.
			If the recipe does not specify a number of people, assume it matches. After listing out the ingredients,
			ask the user to tell you when they are ready to begin. When they are ready, walk them through the recipe
			one action at a time, pausing after each action until the user says they are ready to continue. Many
			recipes have multiple actions in a single formatted step - proceed through each action individually to
			avoid overwhelming the user. For any numeric quantities, divide or multiple so it matches the number of
			people being cooked for, for example if the recipe is for 4 people and the user is cooking for 2, divide
			by 2.

			If the user asks any questions, answer them in a friendly and helpful manner. Always speak slowly and
			clearly.

			Always speak in Japanese. If the recipe is in another language, translate it and convey in Japanese.

			When processing an ingredient list, each ingredient is always a word followed by a quantity. Read each
			ingredient as an item with a three second pause in between each. Ingredient lists never have dates, all
			fractions such as 1/2 are numbers, not dates.

			%s\n\n
			`, recipePrompt)
			chatStream, err := s.genAI.Live.Connect(ctx, "gemini-2.0-flash-live-preview-04-09", &genai.LiveConnectConfig{
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
				Tools: []*genai.Tool{
					{
						FunctionDeclarations: []*genai.FunctionDeclaration{
							{
								Name:        "navigate_to_step",
								Description: "Navigate the UI to a specific step in the recipe.",
								Parameters: &genai.Schema{
									Type: "object",
									Properties: map[string]*genai.Schema{
										"step": {
											Type:        "integer",
											Description: "The index of the step to navigate to, starting from 0.",
										},
									},
									Required: []string{"step"},
								},
							},
						},
					},
				},
			})
			if err != nil {
				return fmt.Errorf("chat: starting genai live session: %w", err)
			}
			s.chatStream = chatStream
			if err := chatStream.SendClientContent(genai.LiveClientContentInput{
				Turns: []*genai.Content{
					genai.NewContentFromText("こんにちは", genai.RoleUser),
				},
			}); err != nil {
				return fmt.Errorf("chat: sending initial client content: %w", err)
			}
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
			if s.chatStreamClosed.Load() {
				// Already intentionally closed so any errors are fine to ignore,
				// in practice they should be network errors.
				return nil
			}
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

func (s *chatSession) closeChatStream() {
	if s.chatStreamClosed.CompareAndSwap(false, true) {
		if s.chatStream != nil {
			if err := s.chatStream.Close(); err != nil {
				slog.Warn("chat: closing genai stream", "error", err)
			}
		}
	}
}
