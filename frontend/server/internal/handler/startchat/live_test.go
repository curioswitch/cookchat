// Copyright (c) CurioSwitch (choko@curioswitch.org)
// SPDX-License-Identifier: BUSL-1.1

package startchat

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"

	"connectrpc.com/connect"
	"github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/option"

	frontendapi "github.com/curioswitch/cookchat/frontend/api/go"
	"github.com/curioswitch/cookchat/frontend/server/internal/i18n"
)

func TestStartChatLive(t *testing.T) {
	for _, language := range []string{"ja", "en"} {
		t.Run(language, func(t *testing.T) {
			var body struct {
				Session struct {
					Model        string `json:"model"`
					Instructions string `json:"instructions"`
					Client       struct {
						DataChannel struct {
							AllowedClientEvents []string `json:"allowed_client_events"`
						} `json:"data_channel"`
					} `json:"client"`
					Input []struct {
						Content []struct {
							Text string `json:"text"`
						} `json:"content"`
					} `json:"input"`
					Audio struct {
						Output struct {
							Voice string `json:"voice"`
						} `json:"output"`
					} `json:"audio"`
					Delegation struct {
						Type      string `json:"type"`
						Responses struct {
							Model             string `json:"model"`
							Instructions      string `json:"instructions"`
							ParallelToolCalls bool   `json:"parallel_tool_calls"`
							Tools             []struct {
								Name string `json:"name"`
							} `json:"tools"`
						} `json:"responses"`
					} `json:"delegation"`
				} `json:"session"`
				Transport struct {
					Type string `json:"type"`
					Sdp  string `json:"sdp"`
				} `json:"transport"`
			}
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.Method != http.MethodPost || r.URL.Path != "/live/sessions" {
					t.Errorf("unexpected request: %s %s", r.Method, r.URL.Path)
				}
				if r.Header.Get("Authorization") != "Bearer server-key" {
					t.Error("missing server credential")
				}
				if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
					t.Error(err)
				}
				w.Header().Set("Content-Type", "application/json")
				_, _ = w.Write([]byte(`{"session":{"id":"live_test"},"transport":{"type":"webrtc","sdp":"answer"}}`))
			}))
			defer server.Close()
			client := openai.NewClient(option.WithBaseURL(server.URL), option.WithAPIKey("server-key"))
			handler := &Handler{openai: &client}
			var ctx context.Context
			request := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/", nil)
			request.Header.Set("Accept-Language", language)
			i18n.Middleware()(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) { ctx = r.Context() })).ServeHTTP(httptest.NewRecorder(), request)
			res, err := handler.startChatOpenAI(ctx, &frontendapi.StartChatRequest{Model: "gpt-live-1", SdpOffer: "offer"}, "recipe context")
			if err != nil {
				t.Fatal(err)
			}
			if res.ChatModel != "gpt-live-1" || res.SdpAnswer != "answer" || res.SessionId != "live_test" || res.ChatApiKey != "" {
				t.Fatalf("unexpected response: %v", res)
			}
			if body.Transport.Type != "webrtc" || body.Transport.Sdp != "offer" || body.Session.Model != "gpt-live-1" {
				t.Fatalf("unexpected session/transport: %+v", body)
			}
			wantLanguage := "Japanese"
			if language == "en" {
				wantLanguage = "English"
			}
			if !strings.Contains(body.Session.Instructions, wantLanguage) || !strings.Contains(body.Session.Input[0].Content[0].Text, wantLanguage) {
				t.Fatal("voice prompt and greeting must use requested language")
			}
			if !slices.Equal(body.Session.Client.DataChannel.AllowedClientEvents, []string{"response.item.create", "response.create", "session.close"}) {
				t.Fatal("browser must only be able to return tools, continue responses, and close")
			}
			backend := body.Session.Delegation.Responses
			if body.Session.Delegation.Type != "responses" || backend.Model == "" || backend.ParallelToolCalls || !strings.Contains(backend.Instructions, "recipe context") {
				t.Fatalf("unexpected delegation: %+v", body.Session.Delegation)
			}
			if len(backend.Tools) != 2 || backend.Tools[0].Name != "navigate_to_step" || backend.Tools[1].Name != "navigate_to_ingredients" {
				t.Fatalf("unexpected tools: %+v", backend.Tools)
			}
			if body.Session.Audio.Output.Voice != "marin" {
				t.Error("unexpected voice")
			}
		})
	}
}

func TestStartChatLiveRequiresOffer(t *testing.T) {
	handler := &Handler{}
	for _, offer := range []string{"", " \n", strings.Repeat("x", 64*1024+1)} {
		_, err := handler.startChatLive(t.Context(), &frontendapi.StartChatRequest{SdpOffer: offer}, "recipe")
		if connect.CodeOf(err) != connect.CodeInvalidArgument {
			t.Fatalf("expected invalid argument, got %v", err)
		}
	}
}

func TestStartChatLiveDoesNotRetryCreation(t *testing.T) {
	calls := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { calls++; w.WriteHeader(http.StatusInternalServerError) }))
	defer server.Close()
	client := openai.NewClient(option.WithBaseURL(server.URL), option.WithAPIKey("test"))
	handler := &Handler{openai: &client}
	_, err := handler.startChatLive(t.Context(), &frontendapi.StartChatRequest{SdpOffer: "offer"}, "recipe")
	if err == nil || calls != 1 {
		t.Fatalf("creation must not retry: calls=%d, err=%v", calls, err)
	}
}
