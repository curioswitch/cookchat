// Copyright (c) CurioSwitch (choko@curioswitch.org)
// SPDX-License-Identifier: BUSL-1.1

package chatplan

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"maps"
	"net/http"
	"net/url"
	"slices"
	"strconv"
	"strings"
	"time"

	cloudtasks "cloud.google.com/go/cloudtasks/apiv2"
	taskspb "cloud.google.com/go/cloudtasks/apiv2/cloudtaskspb"
	discoveryengine "cloud.google.com/go/discoveryengine/apiv1"
	"cloud.google.com/go/firestore"
	"github.com/cenkalti/backoff/v7"
	"github.com/curioswitch/go-usegcp/middleware/firebaseauth"
	"golang.org/x/sync/errgroup"
	"google.golang.org/api/iterator"
	"google.golang.org/genai"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"

	"github.com/curioswitch/cookchat/common/cookchatdb"
	frontendapi "github.com/curioswitch/cookchat/frontend/api/go"
	"github.com/curioswitch/cookchat/frontend/server/internal/config"
	"github.com/curioswitch/cookchat/frontend/server/internal/i18n"
	"github.com/curioswitch/cookchat/frontend/server/internal/llm"
	tasksapi "github.com/curioswitch/cookchat/tasks/api/go"
)

func NewHandler(genAI *genai.Client, store *firestore.Client, search *discoveryengine.SearchClient, tasks *cloudtasks.Client, tasksConfig config.Tasks, filesBucket string) *Handler {
	return &Handler{
		genAI:       genAI,
		store:       store,
		search:      search,
		tasks:       tasks,
		tasksConfig: tasksConfig,
		filesBucket: filesBucket,
	}
}

type Handler struct {
	genAI       *genai.Client
	store       *firestore.Client
	search      *discoveryengine.SearchClient
	tasks       *cloudtasks.Client
	tasksConfig config.Tasks
	filesBucket string
}

const (
	generatedMealPlanPrefix = "GENERATED MEAL PLAN\n"
	partialUpdateInterval   = 500 * time.Millisecond
)

type chatPlanGeneration struct {
	text string
	urls []string
}

func visibleStreamingContent(text string) string {
	normalized := strings.TrimLeft(text, " \t\r\n")
	if strings.HasPrefix(generatedMealPlanPrefix, normalized) || strings.HasPrefix(normalized, generatedMealPlanPrefix) {
		return ""
	}
	return strings.TrimSpace(text)
}

func addResponseURLs(urls map[string]struct{}, res *genai.GenerateContentResponse) {
	if len(res.Candidates) == 0 {
		return
	}
	candidate := res.Candidates[0]
	if cm := candidate.CitationMetadata; cm != nil {
		for _, citation := range cm.Citations {
			if u := citation.URI; u != "" {
				urls[u] = struct{}{}
			}
		}
	}
	if gm := candidate.GroundingMetadata; gm != nil {
		for _, chunk := range gm.GroundingChunks {
			if chunk.Web != nil && chunk.Web.URI != "" {
				urls[chunk.Web.URI] = struct{}{}
			}
		}
	}
}

func (h *Handler) ChatPlan(ctx context.Context, req *frontendapi.ChatPlanRequest) (*frontendapi.ChatPlanResponse, error) {
	userID := firebaseauth.TokenFromContext(ctx).UID

	var uploadedImage *genai.File
	if imageURLs := req.GetImageUrls(); len(imageURLs) == 1 {
		imageBytes, mimeType, err := downloadFirebaseImage(
			ctx,
			imageURLs[0],
			h.filesBucket,
			userID,
		)
		if err != nil {
			return nil, err
		}
		uploadedImage, err = h.genAI.Files.Upload(ctx, bytes.NewReader(imageBytes), &genai.UploadFileConfig{
			MIMEType: mimeType,
		})
		if err != nil {
			return nil, fmt.Errorf("chatplan: uploading attached image to genai: %w", err)
		}
	}

	recentRecipes, err := h.getRecentRecipes(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("chatplan: getting recent recipes: %w", err)
	}

	now := time.Now()

	userDoc := h.store.Collection("users").Doc(userID)
	var user cookchatdb.User
	doc, err := userDoc.Get(ctx)
	if err == nil {
		if err := doc.DataTo(&user); err != nil {
			return nil, fmt.Errorf("chatplan: deserializing firestore user: %w", err)
		}
	}

	chats := userDoc.Collection("chats")
	var chat cookchatdb.Chat
	if cid := req.GetChatId(); cid != "" {
		doc, err := chats.Doc(cid).Get(ctx)
		if err != nil {
			return nil, fmt.Errorf("chatplan: getting chat document: %w", err)
		}
		if err := doc.DataTo(&chat); err != nil {
			return nil, fmt.Errorf("chatplan: decoding chat document: %w", err)
		}
	} else {
		foundChat := false
		if !req.GetNewChat() {
			lastChat, err := chats.Query.OrderBy("createdAt", firestore.Desc).Limit(1).Documents(ctx).Next()
			if err != nil && !errors.Is(err, iterator.Done) {
				return nil, fmt.Errorf("chatplan: getting last chat document: %w", err)
			}
			if lastChat != nil {
				if err := lastChat.DataTo(&chat); err != nil {
					return nil, fmt.Errorf("chatplan: decoding last chat document: %w", err)
				}
				if chat.PlanID == "" {
					foundChat = true
				}
			}
		}
		if !foundChat {
			cid := chats.NewDoc().ID
			chat = cookchatdb.Chat{
				ID:        cid,
				CreatedAt: now,
			}
			if start := req.GetStartTime(); start != nil {
				chat.Start = start.AsTime()
			}
		}
	}
	chat.UpdatedAt = now
	chat.Messages = append(chat.Messages, cookchatdb.ChatMessage{
		Role:      cookchatdb.ChatRoleUser,
		Content:   req.GetMessage(),
		ImageURLs: req.GetImageUrls(),
	})

	content := make([]*genai.Content, len(chat.Messages))
	for i, message := range chat.Messages {
		role := genai.Role(genai.RoleUser)
		if message.Role == cookchatdb.ChatRoleAssistant {
			role = genai.RoleModel
		}
		parts := []*genai.Part{genai.NewPartFromText(message.Content)}
		if i == len(chat.Messages)-1 && uploadedImage != nil {
			parts = append(parts, genai.NewPartFromURI(uploadedImage.URI, uploadedImage.MIMEType))
		}
		content[i] = genai.NewContentFromParts(parts, role)
	}

	// Save so if user refreshes during the slow chat call we can continue in a pending state.
	chat.Messages = append(chat.Messages, cookchatdb.ChatMessage{
		Role:      cookchatdb.ChatRoleAssistant,
		CreatedAt: time.Now(),
		Pending:   true,
	})
	if _, err := chats.Doc(chat.ID).Set(ctx, chat); err != nil {
		return nil, fmt.Errorf("chatplan: saving chat document: %w", err)
	}
	ctx = context.WithoutCancel(ctx)

	lastPublishedContent := ""
	lastPublishedAt := time.Time{}
	publishPartial := func(text string) error {
		visible := visibleStreamingContent(text)
		if visible == "" || visible == lastPublishedContent {
			return nil
		}
		now := time.Now()
		if !lastPublishedAt.IsZero() && now.Sub(lastPublishedAt) < partialUpdateInterval {
			return nil
		}
		chat.Messages[len(chat.Messages)-1].Content = visible
		chat.UpdatedAt = now
		if _, err := chats.Doc(chat.ID).Set(ctx, chat); err != nil {
			return fmt.Errorf("chatplan: saving partial chat response: %w", err)
		}
		lastPublishedContent = visible
		lastPublishedAt = now
		return nil
	}

	generation, err := backoff.Retry(ctx, func() (*chatPlanGeneration, error) {
		var text strings.Builder
		urls := make(map[string]struct{})
		receivedText := false
		stream := h.genAI.Models.GenerateContentStream(ctx, "gemini-3.6-flash", content, &genai.GenerateContentConfig{
			SystemInstruction: genai.NewContentFromText(llm.ChatPlanPrompt(strings.Join(recentRecipes, ", "), user.PlanPrompt), genai.RoleModel),
			ThinkingConfig: &genai.ThinkingConfig{
				ThinkingLevel: genai.ThinkingLevelMinimal,
			},
			Tools: []*genai.Tool{
				{
					GoogleSearch: &genai.GoogleSearch{},
				},
			},
		})
		for res, streamErr := range stream {
			if streamErr != nil {
				err := fmt.Errorf("chatplan: streaming GenerateContent for plan: %w", streamErr)
				if receivedText {
					return nil, backoff.Permanent(err)
				}
				return nil, err
			}
			chunkText := res.Text()
			if chunkText != "" {
				receivedText = true
				text.WriteString(chunkText)
				if err := publishPartial(text.String()); err != nil {
					return nil, backoff.Permanent(err)
				}
			}
			addResponseURLs(urls, res)
		}
		if text.Len() == 0 {
			return nil, errors.New("chatplan: generate ai returned an empty response")
		}
		return &chatPlanGeneration{
			text: text.String(),
			urls: slices.Collect(maps.Keys(urls)),
		}, nil
	})
	if err != nil {
		// Back out with best-effort
		chat.Messages = chat.Messages[:len(chat.Messages)-2]
		if _, err := chats.Doc(chat.ID).Set(ctx, chat); err != nil {
			return nil, fmt.Errorf("chatplan: saving chat document: %w", err)
		}
		return nil, err
	}

	resText := strings.TrimSpace(generation.text)
	if _, resJSON, ok := strings.Cut(resText, generatedMealPlanPrefix); ok {
		var plans [][]cookchatdb.RecipeContent
		if err := json.Unmarshal([]byte(resJSON), &plans); err != nil {
			return nil, fmt.Errorf("chatplan: error deserializing LLM JSON response: %w", err)
		}
		start := chat.Start
		if start.IsZero() {
			start = time.Now()
		}
		for i, planContent := range plans {
			plan, err := h.savePlan(ctx, planContent, start, i)
			if err != nil {
				return nil, err
			}
			planID := plan.ID

			fillPlanReq, err := proto.Marshal(&tasksapi.FillPlanRequest{
				PlanId: planID,
			})
			if err != nil {
				return nil, fmt.Errorf("chatplan: marshaling fill plan request: %w", err)
			}

			fbTok := firebaseauth.RawTokenFromContext(ctx)

			task := &taskspb.CreateTaskRequest{
				Parent: h.tasksConfig.Queue,
				Task: &taskspb.Task{
					MessageType: &taskspb.Task_HttpRequest{
						HttpRequest: &taskspb.HttpRequest{
							HttpMethod: taskspb.HttpMethod_POST,
							Url:        h.tasksConfig.URL + "/tasksapi.TasksService/FillPlan",
							Headers: map[string]string{
								"Content-Type":             "application/proto",
								"Content-Length":           strconv.Itoa(len(fillPlanReq)),
								"X-Original-Authorization": "Bearer " + fbTok,
							},
							Body: fillPlanReq,
							AuthorizationHeader: &taskspb.HttpRequest_OidcToken{
								OidcToken: &taskspb.OidcToken{
									ServiceAccountEmail: h.tasksConfig.Invoker,
								},
							},
						},
					},
				},
			}
			if _, err := h.tasks.CreateTask(ctx, task); err != nil {
				return nil, fmt.Errorf("chatplan: creating task: %w", err)
			}

			if chat.PlanID == "" {
				chat.PlanID = planID
			}
			// TODO: Do something better
			switch i18n.UserLanguage(ctx) {
			case "ja":
				chat.Messages[len(chat.Messages)-1].Content = "あなたの献立を作成しました。"
			default:
				chat.Messages[len(chat.Messages)-1].Content = "Created your meal plan."
			}
			chat.Messages[len(chat.Messages)-1].Pending = false
			if _, err := chats.Doc(chat.ID).Set(ctx, chat); err != nil {
				return nil, fmt.Errorf("chatplan: saving chat plan ID: %w", err)
			}
		}
		return &frontendapi.ChatPlanResponse{
			ChatId: chat.ID,
			PlanId: chat.PlanID,
		}, nil
	}

	chat.Messages[len(chat.Messages)-1].Content = resText
	chat.Messages[len(chat.Messages)-1].Pending = false

	if _, err := chats.Doc(chat.ID).Set(ctx, chat); err != nil {
		return nil, fmt.Errorf("chatplan: saving chat document: %w", err)
	}

	messages := make([]*frontendapi.ChatMessage, len(chat.Messages))
	for i, message := range chat.Messages {
		msg := &frontendapi.ChatMessage{
			Content:   message.Content,
			ImageUrls: message.ImageURLs,
			Pending:   message.Pending,
		}
		switch message.Role {
		case cookchatdb.ChatRoleUser:
			msg.Role = frontendapi.ChatMessage_ROLE_USER
		case cookchatdb.ChatRoleAssistant:
			msg.Role = frontendapi.ChatMessage_ROLE_ASSISTANT
		}
		messages[i] = msg
	}
	messages[len(messages)-1].Urls = generation.urls

	return &frontendapi.ChatPlanResponse{
		ChatId:   chat.ID,
		Messages: messages,
	}, nil
}

const maxAttachedImageBytes = 5 << 20

var firebaseStorageEndpoint = "https://firebasestorage.googleapis.com"

func downloadFirebaseImage(ctx context.Context, imageURL, filesBucket, userID string) ([]byte, string, error) {
	parsed, err := url.Parse(imageURL)
	if err != nil {
		return nil, "", fmt.Errorf("chatplan: parsing image URL: %w", err)
	}
	if parsed.Scheme != "gs" || parsed.Host != filesBucket {
		return nil, "", errors.New("chatplan: image URL references unexpected bucket")
	}

	objectPath := strings.TrimPrefix(parsed.Path, "/")
	if objectPath == "" || !strings.HasPrefix(objectPath, userID+"/") {
		return nil, "", errors.New("chatplan: image URL references unexpected user")
	}

	downloadURL := firebaseStorageEndpoint + "/v0/b/" +
		url.PathEscape(filesBucket) + "/o/" + url.PathEscape(objectPath) + "?alt=media"
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, downloadURL, nil)
	if err != nil {
		return nil, "", fmt.Errorf("chatplan: creating Firebase Storage request: %w", err)
	}
	// Firebase Storage Security Rules evaluate the end user's ID token. Deliberately
	// do not use application default credentials or the server service account.
	httpReq.Header.Set("Authorization", "Firebase "+firebaseauth.RawTokenFromContext(ctx))

	res, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		return nil, "", fmt.Errorf("chatplan: fetching attached image: %w", err)
	}
	defer func() {
		_ = res.Body.Close()
	}()
	if res.StatusCode != http.StatusOK {
		_, _ = io.Copy(io.Discard, io.LimitReader(res.Body, 4<<10))
		return nil, "", fmt.Errorf("chatplan: unexpected Firebase Storage response status: %s", res.Status)
	}
	if res.ContentLength > maxAttachedImageBytes {
		return nil, "", errors.New("chatplan: attached image exceeds 5 MiB")
	}

	mimeType := strings.TrimSpace(strings.Split(res.Header.Get("Content-Type"), ";")[0])
	if !strings.HasPrefix(mimeType, "image/") {
		return nil, "", fmt.Errorf("chatplan: unsupported attached image content type: %q", mimeType)
	}
	data, err := io.ReadAll(io.LimitReader(res.Body, maxAttachedImageBytes+1))
	if err != nil {
		return nil, "", fmt.Errorf("chatplan: reading attached image: %w", err)
	}
	if len(data) > maxAttachedImageBytes {
		return nil, "", errors.New("chatplan: attached image exceeds 5 MiB")
	}
	return data, mimeType, nil
}

func (h *Handler) savePlan(ctx context.Context, recipeContents []cookchatdb.RecipeContent, start time.Time, index int) (cookchatdb.Plan, error) {
	language := i18n.UserLanguage(ctx)
	var grp errgroup.Group
	plan := cookchatdb.Plan{
		Recipes: make([]string, 0, len(recipeContents)),
	}
	for _, content := range recipeContents {
		grp.Go(func() error {
			recipeID := h.store.Collection("recipes").NewDoc().ID
			docID := "chatplan-" + recipeID
			recipe := cookchatdb.Recipe{
				ID:           recipeID,
				Source:       cookchatdb.RecipeSourceAI,
				Status:       cookchatdb.RecipeStatusProcessing,
				Content:      content,
				LanguageCode: language,
			}

			if url := content.SourceURL; url != "" {
				switch {
				case strings.HasPrefix(url, "https://delishkitchen.tv/recipes/"):
					recipe.Source = cookchatdb.RecipeSourceDelishKitchen
					recipe.SourceID = url[len("https://delishkitchen.tv/recipes/"):]
					docID = "delishkitchen-" + recipe.SourceID
				case strings.HasPrefix(url, "https://www.orangepage.net/news-daily/"):
					recipe.Source = cookchatdb.RecipeSourceOrangePage
					recipe.SourceID = url[len("https://www.orangepage.net/news-daily/"):]
					docID = "orangepage-" + recipe.SourceID
				case strings.HasPrefix(url, "https://cookpad.com/recipe/"):
					recipe.Source = cookchatdb.RecipeSourceCookpad
					recipe.SourceID = url[len("https://cookpad.com/recipe/"):]
					docID = "cookpad-" + recipe.SourceID
				}
			}

			if existing, err := h.store.Collection("recipes").Doc(docID).Get(ctx); status.Code(err) != codes.NotFound {
				idAny, _ := existing.DataAt("id")
				if idStr, ok := idAny.(string); ok {
					plan.Recipes = append(plan.Recipes, idStr)
					return nil
				}
			}
			rDoc := h.store.Collection("recipes").Doc(docID)
			if _, err := rDoc.Create(ctx, recipe); err != nil {
				return fmt.Errorf("chatplan: saving recipe %q: %w", recipe.ID, err)
			}
			plan.Recipes = append(plan.Recipes, recipeID)

			return nil
		})
	}
	if err := grp.Wait(); err != nil {
		return cookchatdb.Plan{}, err
	}

	userID := firebaseauth.TokenFromContext(ctx).UID

	plansCol := h.store.Collection("users").Doc(userID).Collection("plans")
	planDoc := plansCol.NewDoc()
	plan.ID = planDoc.ID
	plan.ScheduledAt = start.Add(time.Duration(index) * 24 * time.Hour)
	plan.CreatedAt = start
	plan.Status = cookchatdb.PlanStatusProcessing
	if _, err := planDoc.Set(ctx, plan); err != nil {
		return plan, fmt.Errorf("chatplan: failed to set plan document: %w", err)
	}

	return plan, nil
}

func (h *Handler) getRecentRecipes(ctx context.Context, userID string) ([]string, error) {
	now := time.Now()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	start := today.Add(-2 * 7 * 24 * time.Hour)

	plansCol := h.store.Collection("users").Doc(userID).Collection("plans")
	iter := plansCol.Query.WhereEntity(firestore.AndFilter{
		Filters: []firestore.EntityFilter{
			firestore.PropertyFilter{
				Path:     firestore.DocumentID,
				Operator: ">=",
				Value:    plansCol.Doc(start.Format(time.DateOnly)),
			},
			firestore.PropertyFilter{
				Path:     firestore.DocumentID,
				Operator: "<=",
				Value:    plansCol.Doc(today.Format(time.DateOnly)),
			},
		},
	}).Documents(ctx)
	defer iter.Stop()

	recipeIDs := make(map[string]struct{})
	for {
		doc, err := iter.Next()
		if errors.Is(err, iterator.Done) {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("chatplan: fetching plan: %w", err)
		}

		var plan cookchatdb.Plan
		if err := doc.DataTo(&plan); err != nil {
			return nil, fmt.Errorf("chatplan: decoding plan: %w", err)
		}
		for _, recipeID := range plan.Recipes {
			recipeIDs[recipeID] = struct{}{}
		}
	}

	var recipeTitles []string
	if len(recipeIDs) == 0 {
		return recipeTitles, nil
	}

	recipesCol := h.store.Collection("recipes")
	iter = recipesCol.Query.WhereEntity(firestore.PropertyFilter{
		Path:     "id",
		Operator: "in",
		Value:    slices.Collect(maps.Keys(recipeIDs)),
	}).Documents(ctx)
	defer iter.Stop()

	for {
		doc, err := iter.Next()
		if errors.Is(err, iterator.Done) {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("chatplan: fetching recipe: %w", err)
		}
		var recipe cookchatdb.Recipe
		if err := doc.DataTo(&recipe); err != nil {
			return nil, fmt.Errorf("chatplan: decoding recipe: %w", err)
		}
		recipeTitles = append(recipeTitles, recipe.Content.Title)
	}

	return recipeTitles, nil
}
