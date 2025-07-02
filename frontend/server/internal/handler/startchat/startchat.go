package startchat

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"

	"cloud.google.com/go/firestore"
	"connectrpc.com/connect"
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

// Handler starts a new chat.
type Handler struct {
	genAI *genai.Client
	store *firestore.Client
}

func (h *Handler) StartChat(ctx context.Context, req *frontendapi.StartChatRequest) (*frontendapi.StartChatResponse, error) {
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
		recipeJSON, err := json.Marshal(recipeDoc.Data())
		if err != nil {
			return nil, fmt.Errorf("chat: marshalling recipe to JSON: %w", err)
		}
		recipePrompt = "The recipe in structured JSON format is as follows:\n" + string(recipeJSON)
	}

	prompt := fmt.Sprintf(`You are a cooking assistant that helps a user work through a recipe. 
			Start by greeting the user and acknowleding the recipe they are trying to cook. Then ask them how many
			people they are preparing for. When they answer, list out the required ingredients for the specified number
			of people. Divide or multiply the numbers in the recipe if the number of people doesn't match the recipe.
			If the recipe does not specify a number of people, assume it matches. After listing out the ingredients,
			ask the user to tell you when they are ready to begin. Do not proceed if they only acknowledge you with
			something like "はい" or "わかりました". Wait for them to say more clearly they are ready.
			
			When they are ready, walk them through the recipe
			one action at a time, pausing after each action until the user says they are ready to continue. Many
			recipes have multiple actions in a single formatted step - proceed through each action individually to
			avoid overwhelming the user. For any numeric quantities, divide or multiple so it matches the number of
			people being cooked for, for example if the recipe is for 4 people and the user is cooking for 2, divide
			by 2. Ingredient names may be prefaced by a symbol such as a star. When a recipe step uses the symbol,
			speak the ingredient names instead of the symbol. When proceeding to a step of the recipe, use the
			"navigate_to_step" tool to navigate the UI to the step index, starting from 0 for the first step. You will
			call the tool before reading the first step after reading the ingredients and anytime you navigate forward
			or backward to a step.

			When reading ingredients, 大# should be read as おおさじ#, 小# should be read as こさじ#,
			#片 should be read as #へん。

			If the user asks any questions, answer them in a friendly and helpful manner. Always speak slowly and
			clearly.

			Always speak in Japanese. If the recipe is in another language, translate it and convey in Japanese.

			When processing an ingredient list, each ingredient is always a word followed by a quantity. Read each
			ingredient as an item with a three second pause in between each. Ingredient lists never have dates, all
			fractions such as 1/2 are numbers, not dates.

			%s\n\n
			`, recipePrompt)

	switch req.GetModelProvider() {
	case frontendapi.StartChatRequest_MODEL_PROVIDER_UNSPECIFIED, frontendapi.StartChatRequest_MODEL_PROVIDER_GOOGLE_GENAI:
		return h.startChatGemini(ctx, prompt)
	case frontendapi.StartChatRequest_MODEL_PROVIDER_OPENAI:
		return h.startChatOpenAI(ctx, prompt)
	}

	return h.startChatOpenAI(ctx, prompt)
}

func (h *Handler) startChatGemini(ctx context.Context, prompt string) (*frontendapi.StartChatResponse, error) {
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
					LanguageCode: "ja-JP",
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

type openaiTool struct {
	Name        string       `json:"name"`
	Description string       `json:"description"`
	Type        string       `json:"type"`
	Parameters  genai.Schema `json:"parameters"`
}

type realtimeSessionsRequest struct {
	Model        string       `json:"model"`
	Instructions string       `json:"instructions"`
	Tools        []openaiTool `json:"tools"`
	Voice        string       `json:"voice"`
}

type clientSecret struct {
	Value string `json:"value"`
}

type realtimeSessionsResponse struct {
	ClientSecret clientSecret `json:"client_secret"`
}

func (h *Handler) startChatOpenAI(ctx context.Context, prompt string) (*frontendapi.StartChatResponse, error) {
	apiKey := os.Getenv("OPENAI_API_KEY")
	model := "gpt-4o-realtime-preview"
	req := realtimeSessionsRequest{
		Model:        model,
		Instructions: prompt,
		Voice:        "echo",
		Tools: []openaiTool{
			{
				Name:        "navigate_to_step",
				Description: "Navigate the UI to a specific step in the recipe.",
				Type:        "function",
				Parameters: genai.Schema{
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
	}

	reqJSON, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("chat: marshalling realtime request: %w", err)
	}

	httpReq, _ := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.openai.com/v1/realtime/sessions", bytes.NewReader(reqJSON))
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+apiKey)
	httpRes, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("startchat: sending realtime request: %w", err)
	}
	defer func() {
		_ = httpRes.Body.Close()
	}()
	if httpRes.StatusCode != http.StatusOK {
		body, err := io.ReadAll(httpRes.Body)
		if err != nil {
			return nil, fmt.Errorf("startchat: reading realtime error body: %w", err)
		}
		return nil, fmt.Errorf("startchat: realtime request failed with status %d: %s", httpRes.StatusCode, body) //nolint:err113
	}

	var res realtimeSessionsResponse
	if err := json.NewDecoder(httpRes.Body).Decode(&res); err != nil {
		return nil, fmt.Errorf("startchat: decoding realtime response: %w", err)
	}
	return &frontendapi.StartChatResponse{
		ChatApiKey:       res.ClientSecret.Value,
		ChatModel:        model,
		ChatInstructions: prompt,
	}, nil
}
