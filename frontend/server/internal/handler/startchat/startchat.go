// Copyright (c) CurioSwitch (choko@curioswitch.org)
// SPDX-License-Identifier: BUSL-1.1

package startchat

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"

	"cloud.google.com/go/firestore"
	"connectrpc.com/connect"
	"github.com/openai/openai-go/v2"
	"github.com/openai/openai-go/v2/realtime"
	"google.golang.org/api/iterator"
	"google.golang.org/genai"

	"github.com/curioswitch/cookchat/common/cookchatdb"
	frontendapi "github.com/curioswitch/cookchat/frontend/api/go"
	"github.com/curioswitch/cookchat/frontend/server/internal/auth"
	"github.com/curioswitch/cookchat/frontend/server/internal/i18n"
	"github.com/curioswitch/cookchat/frontend/server/internal/llm"
)

// NewHandler returns a Handler.
func NewHandler(genAI *genai.Client, openai *openai.Client, store *firestore.Client) *Handler {
	return &Handler{
		genAI:  genAI,
		openai: openai,
		store:  store,
	}
}

// Handler starts a new chat.
type Handler struct {
	genAI  *genai.Client
	openai *openai.Client
	store  *firestore.Client
}

func (h *Handler) StartChat(ctx context.Context, req *frontendapi.StartChatRequest) (*frontendapi.StartChatResponse, error) {
	language := i18n.UserLanguage(ctx)

	recipePrompt := ""
	if r := req.GetRecipeText(); r != "" {
		recipePrompt = "The recipe is as follows:\n" + r
	} else if rid := req.GetRecipeId(); rid != "" {
		recipeDoc, err := h.store.Collection("recipes").Where("id", "==", rid).Limit(1).Documents(ctx).Next()
		if err != nil {
			if errors.Is(err, iterator.Done) {
				return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("chat: recipe not found: %w", err))
			}
			return nil, fmt.Errorf("chat: getting recipe from firestore: %w", err)
		}
		var recipe cookchatdb.Recipe
		if err := recipeDoc.DataTo(&recipe); err != nil {
			return nil, fmt.Errorf("chat: unmarshalling recipe: %w", err)
		}
		var recipeJSON []byte
		if rlc := recipe.LocalizedContent[language]; rlc != nil {
			recipeJSON, err = json.Marshal(rlc)
		} else {
			recipeJSON, err = json.Marshal(recipe)
		}
		if err != nil {
			return nil, fmt.Errorf("chat: marshalling recipe to JSON: %w", err)
		}
		recipePrompt = "The recipe in structured JSON format is as follows:\n" + string(recipeJSON)
	}

	prompt := llm.RecipeChatPrompt(ctx)
	if p := req.GetLlmPrompt(); p != "" && auth.IsCurioSwitchUser(ctx) {
		prompt = p + "\n\n"
	}
	prompt += recipePrompt + "\n\n"

	var res *frontendapi.StartChatResponse
	var err error
	switch req.GetModelProvider() {
	case frontendapi.StartChatRequest_MODEL_PROVIDER_UNSPECIFIED, frontendapi.StartChatRequest_MODEL_PROVIDER_GOOGLE_GENAI:
		res, err = h.startChatGemini(ctx, prompt)
	case frontendapi.StartChatRequest_MODEL_PROVIDER_OPENAI:
		res, err = h.startChatOpenAI(ctx, prompt)
	}

	if err != nil {
		return nil, err
	}

	switch language {
	case "en":
		res.StartMessage = "Hello!"
	default:
		res.StartMessage = "こんにちは！"
	}

	return res, nil
}

func (h *Handler) startChatGemini(ctx context.Context, prompt string) (*frontendapi.StartChatResponse, error) {
	languageCode := "ja-JP"
	if i18n.UserLanguage(ctx) == "en" {
		languageCode = "en-US"
	}

	// Until genai Go SDK supports token creation, issue request manually.
	model := "gemini-live-2.5-flash-preview"
	cfg := tokenConfig{
		Uses: 1,
		BidiGenerateContentSetup: &bidiGenerateContentSetup{
			Model: "models/" + model,
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
							Behavior:    genai.BehaviorNonBlocking,
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
			GenerationConfig: genai.LiveConnectConfig{
				ResponseModalities: []genai.Modality{genai.ModalityAudio},
				SpeechConfig: &genai.SpeechConfig{
					LanguageCode: languageCode,
					VoiceConfig: &genai.VoiceConfig{
						PrebuiltVoiceConfig: &genai.PrebuiltVoiceConfig{
							VoiceName: "Leda",
						},
					},
				},
			},
		},
	}
	cfgJSON, err := json.Marshal(cfg)
	if err != nil {
		return nil, fmt.Errorf("chat: marshalling token config: %w", err)
	}

	tokReq, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://generativelanguage.googleapis.com/v1alpha/auth_tokens", bytes.NewReader(cfgJSON))
	if err != nil {
		return nil, fmt.Errorf("chat: creating token request: %w", err)
	}
	tokReq.Header.Set("Content-Type", "application/json")
	tokReq.Header.Set("X-Goog-Api-Key", h.genAI.ClientConfig().APIKey)
	tokRes, err := http.DefaultClient.Do(tokReq)
	if err != nil {
		return nil, fmt.Errorf("chat: sending token request: %w", err)
	}
	defer func() {
		_ = tokRes.Body.Close()
	}()
	if tokRes.StatusCode != http.StatusOK {
		body, err := io.ReadAll(tokRes.Body)
		if err != nil {
			return nil, fmt.Errorf("chat: reading token response body: %w", err)
		}
		return nil, fmt.Errorf("chat: token request failed with status %d: %s", tokRes.StatusCode, body) //nolint:err113
	}
	var tokenResp tokenResponse
	if err := json.NewDecoder(tokRes.Body).Decode(&tokenResp); err != nil {
		return nil, fmt.Errorf("chat: decoding token response: %w", err)
	}
	return &frontendapi.StartChatResponse{
		ChatApiKey: tokenResp.Name,
		ChatModel:  model,
	}, nil
}

type bidiGenerateContentSetup struct {
	Model             string                  `json:"model"`
	SystemInstruction *genai.Content          `json:"systemInstruction,omitempty"`
	Tools             []*genai.Tool           `json:"tools,omitempty"`
	GenerationConfig  genai.LiveConnectConfig `json:"generationConfig"`
}

type tokenConfig struct {
	Uses                     int                       `json:"uses"`
	BidiGenerateContentSetup *bidiGenerateContentSetup `json:"bidiGenerateContentSetup,omitempty"`
}

type tokenResponse struct {
	Name string `json:"name"`
}

func (h *Handler) startChatOpenAI(ctx context.Context, prompt string) (*frontendapi.StartChatResponse, error) {
	model := "gpt-realtime"
	res, err := h.openai.Realtime.ClientSecrets.New(ctx, realtime.ClientSecretNewParams{
		Session: realtime.ClientSecretNewParamsSessionUnion{
			OfRealtime: &realtime.RealtimeSessionCreateRequestParam{
				Model:        model,
				Instructions: openai.String(prompt),
				Audio: realtime.RealtimeAudioConfigParam{
					Output: realtime.RealtimeAudioConfigOutputParam{
						Voice: "marin",
					},
				},
			},
		},
	})
	if err != nil {
		return nil, fmt.Errorf("startchat: creating OpenAI Realtime session: %w", err)
	}

	return &frontendapi.StartChatResponse{
		ChatApiKey:       res.Value,
		ChatModel:        model,
		ChatInstructions: prompt,
	}, nil
}
