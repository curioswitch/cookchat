// Copyright (c) CurioSwitch (choko@curioswitch.org)
// SPDX-License-Identifier: BUSL-1.1

package main

import (
	"context"
	"embed"
	"fmt"
	"io/fs"
	"log/slog"
	"net/http"
	"os"
	"slices"
	"strings"

	discoveryengine "cloud.google.com/go/discoveryengine/apiv1"
	"cloud.google.com/go/storage"
	firebase "firebase.google.com/go/v4"
	"github.com/curioswitch/go-curiostack/server"
	"github.com/curioswitch/go-usegcp/middleware/firebaseauth"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/openai/openai-go/v3"
	"google.golang.org/genai"

	frontendapi "github.com/curioswitch/cookchat/frontend/api/go"
	"github.com/curioswitch/cookchat/frontend/api/go/frontendapiconnect"
	"github.com/curioswitch/cookchat/frontend/server/internal/config"
	"github.com/curioswitch/cookchat/frontend/server/internal/handler/addbookmark"
	"github.com/curioswitch/cookchat/frontend/server/internal/handler/addrecipe"
	"github.com/curioswitch/cookchat/frontend/server/internal/handler/chatplan"
	"github.com/curioswitch/cookchat/frontend/server/internal/handler/generateplan"
	"github.com/curioswitch/cookchat/frontend/server/internal/handler/generaterecipe"
	"github.com/curioswitch/cookchat/frontend/server/internal/handler/getplan"
	"github.com/curioswitch/cookchat/frontend/server/internal/handler/getplans"
	"github.com/curioswitch/cookchat/frontend/server/internal/handler/getrecipe"
	"github.com/curioswitch/cookchat/frontend/server/internal/handler/listrecipes"
	"github.com/curioswitch/cookchat/frontend/server/internal/handler/removebookmark"
	"github.com/curioswitch/cookchat/frontend/server/internal/handler/startchat"
	"github.com/curioswitch/cookchat/frontend/server/internal/handler/updateplan"
	"github.com/curioswitch/cookchat/frontend/server/internal/i18n"
)

//go:embed conf/*.yaml
var confFiles embed.FS

func main() {
	conf, _ := fs.Sub(confFiles, "conf")
	os.Exit(server.Main(&config.Config{}, conf, setupServer))
}

func setupServer(ctx context.Context, conf *config.Config, s *server.Server) error {
	mux := server.Mux(s)

	fbApp, err := firebase.NewApp(ctx, &firebase.Config{ProjectID: conf.Google.Project})
	if err != nil {
		return fmt.Errorf("main: create firebase app: %w", err)
	}

	fbAuth, err := fbApp.Auth(ctx)
	if err != nil {
		return fmt.Errorf("main: create firebase auth client: %w", err)
	}

	firestore, err := fbApp.Firestore(ctx)
	if err != nil {
		return fmt.Errorf("main: create firestore client: %w", err)
	}
	defer func() {
		if err := firestore.Close(); err != nil {
			slog.ErrorContext(ctx, "main: close firestore client", "error", err)
		}
	}()

	storage, err := storage.NewGRPCClient(ctx)
	if err != nil {
		return fmt.Errorf("main: create storage client: %w", err)
	}
	defer func() {
		if err := storage.Close(); err != nil {
			slog.ErrorContext(ctx, "main: close storage client", "error", err)
		}
	}()
	publicBucket := conf.Google.Project + "-public"

	search, err := discoveryengine.NewSearchClient(ctx)
	if err != nil {
		return fmt.Errorf("main: create discovery engine search client: %w", err)
	}
	defer func() {
		if err := search.Close(); err != nil {
			slog.ErrorContext(ctx, "main: close discovery engine search client", "error", err)
		}
	}()

	genAI, err := genai.NewClient(ctx, &genai.ClientConfig{
		Backend: genai.BackendGeminiAPI,
		Project: conf.Google.Project,
	})
	if err != nil {
		return fmt.Errorf("creating genai client: %w", err)
	}

	oai := openai.NewClient()

	authorizedEmails := strings.Split(conf.Authorization.EmailsCSV, ",")

	fbMW := firebaseauth.NewMiddleware(fbAuth)
	requireAccess := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			tok := firebaseauth.TokenFromContext(r.Context())
			if id, ok := tok.Firebase.Identities["email"]; ok {
				if idAny, ok := id.([]any); ok && len(idAny) > 0 {
					if email, ok := idAny[0].(string); ok {
						if strings.HasSuffix(email, "@curioswitch.org") || slices.Contains(authorizedEmails, email) {
							next.ServeHTTP(w, r)
							return
						}
					}
				}
			}
			http.Error(w, "permission denied", http.StatusForbidden)
		})
	}

	mux.Use(middleware.Maybe(func(h http.Handler) http.Handler {
		return fbMW(requireAccess(h))
	}, func(r *http.Request) bool {
		switch {
		case strings.HasPrefix(r.URL.Path, "/internal/"):
			return false
		default:
			return true
		}
	}))

	mux.Use(i18n.Middleware())

	server.HandleConnectUnary(s,
		frontendapiconnect.FrontendServiceGetRecipeProcedure,
		getrecipe.NewHandler(firestore).GetRecipe,
		[]*frontendapi.GetRecipeRequest{
			{
				RecipeId: "02JNMi0W1605TLxzQt6v",
			},
		},
	)

	server.HandleConnectUnary(s,
		frontendapiconnect.FrontendServiceListRecipesProcedure,
		listrecipes.NewHandler(firestore, search, conf.Search.Engine).ListRecipes,
		[]*frontendapi.ListRecipesRequest{
			{},
			{
				Query: "玉ねぎ",
			},
			{
				Bookmarks: true,
			},
		},
	)

	server.HandleConnectUnary(s,
		frontendapiconnect.FrontendServiceStartChatProcedure,
		startchat.NewHandler(genAI, &oai, firestore).StartChat,
		[]*frontendapi.StartChatRequest{
			{
				Recipe: &frontendapi.StartChatRequest_RecipeId{
					RecipeId: "02JNMi0W1605TLxzQt6v",
				},
			},
		})

	server.HandleConnectUnary(s,
		frontendapiconnect.FrontendServiceGenerateRecipeProcedure,
		generaterecipe.NewHandler(genAI, firestore, storage, publicBucket).GenerateRecipe,
		[]*frontendapi.GenerateRecipeRequest{
			{
				Prompt: "I have potatoes and onions in my fridge. I want a nice Japanese dish to cook.",
			},
		})

	server.HandleConnectUnary(s,
		frontendapiconnect.FrontendServiceGeneratePlanProcedure,
		generateplan.NewHandler(genAI, firestore, search).GeneratePlan,
		[]*frontendapi.GeneratePlanRequest{
			{
				NumDays:     3,
				Ingredients: []string{"onions", "potatoes"},
				Genres: []frontendapi.RecipeGenre{
					frontendapi.RecipeGenre_RECIPE_GENRE_JAPANESE,
					frontendapi.RecipeGenre_RECIPE_GENRE_ITALIAN,
				},
			},
		})

	messagesEN := []*frontendapi.ChatMessage{
		{
			Role:    frontendapi.ChatMessage_ROLE_USER,
			Content: "Hello.",
		},
		{
			Role:    frontendapi.ChatMessage_ROLE_ASSISTANT,
			Content: "Hello! I can help you plan your meals. To get started, please tell me:\n\n1.  How many days would you like to plan meals for?\n2.  Are there any ingredients you'd like to use up or feature in your meals?\n3.  Do you have any dietary restrictions (e.g., vegetarian, gluten-free, no nuts) or preferences (e.g., \"I love spicy food,\" \"no seafood\")?",
		},
		{
			Role:    frontendapi.ChatMessage_ROLE_USER,
			Content: "1 day. I want to use onions and tomatoes. No seafood.",
		},
		{
			Role:    frontendapi.ChatMessage_ROLE_ASSISTANT,
			Content: "Great! Onions and tomatoes are versatile ingredients. I've found a couple of delicious main dish options that feature them and are completely free of seafood.\n\nHere are two options for your main dish. Please let me know which one sounds better to you, or if you'd like to explore other choices:\n\n1.  **Chicken Stew with Onions, Tomatoes, and Dijon**: This is a hearty and flavorful stew with chicken, lots of red onions, and canned tomatoes, seasoned with Dijon mustard. It's a comforting meal that makes good use of your requested ingredients.\n2.  **Shakshuka**: A popular North African and Middle Eastern vegetarian dish. It features eggs poached in a flavorful sauce of sautéed onions, bell peppers, garlic, and tomatoes, seasoned with spices like paprika, cumin, and chili powder. It's typically eaten for breakfast but can be enjoyed any time of day.\n\nOnce you choose a main dish, I can also suggest a complementary side or soup, if you'd like!",
		},
		{
			Role:    frontendapi.ChatMessage_ROLE_USER,
			Content: "Let's go with the Shakshuka.",
		},
		{
			Role:    frontendapi.ChatMessage_ROLE_ASSISTANT,
			Content: "Excellent choice! Shakshuka is a fantastic and flavorful dish, perfect for using up your onions and tomatoes.\n\nTo complement the Shakshuka, which is quite rich and satisfying on its own, I recommend either:\n\n1.  **Warm Pita Bread**: Perfect for scooping up all that delicious tomato sauce and runny egg yolk.\n2.  **A Simple Green Salad**: Something light and refreshing, like an arugula salad with a lemon vinaigrette, would cut through the richness of the Shakshuka beautifully.\n3.  **Hummus**: A creamy, savory dip that pairs wonderfully with the flavors of Shakshuka and pita bread.\n\nWhich of these sounds best for your meal?",
		},
		{
			Role:    frontendapi.ChatMessage_ROLE_USER,
			Content: "Green salad and hummus. That's it.",
		},
	}
	messagesJA := []*frontendapi.ChatMessage{
		{
			Role:    frontendapi.ChatMessage_ROLE_USER,
			Content: "こんにちは",
		},
		{
			Role:    frontendapi.ChatMessage_ROLE_ASSISTANT,
			Content: "こんにちは！献立作成のお手伝いをさせていただきます。\n\nまず、いくつか質問させてください。\n\n1.  何日分の献立を立てたいですか？\n2.  使いたい食材はありますか？（例：鶏肉、大根、きのこなど）\n3.  何か食べ物の好みや、アレルギー、避けてほしい食材など、食事に関する制約はありますか？（例：辛いものが苦手、乳製品アレルギー、魚は食べたくないなど）",
		},
		{
			Role:    frontendapi.ChatMessage_ROLE_USER,
			Content: "1日分。玉ねぎとトマトを使いたい。魚なしで。",
		},
		{
			Role:    frontendapi.ChatMessage_ROLE_ASSISTANT,
			Content: "1日分の献立ですね！玉ねぎとトマトを使って、魚なしというご希望、承知いたしました。\n\nメイン料理として、玉ねぎとトマトをたっぷり使った「新玉ねぎの肉詰めチーズトマト煮」はいかがでしょうか？豚ひき肉を詰めた新玉ねぎを、トマトソースとチーズで煮込んだ、ボリュームたっぷりで食べ応えのある一品です。とろとろの玉ねぎとジューシーな肉だね、そしてトマトの酸味とチーズのコクが絶妙にマッチしますよ。\n\nこのレシピでよろしければ、副菜とスープも提案させていただきます。",
		},
		{
			Role:    frontendapi.ChatMessage_ROLE_USER,
			Content: "それにします。",
		},
		{
			Role:    frontendapi.ChatMessage_ROLE_ASSISTANT,
			Content: "かしこまりました！メインを「新玉ねぎの肉詰めチーズトマト煮」で進めさせていただきます。\n\nそれでは、このメインに合う副菜とスープを提案しますね。\n\n**副菜の提案**\n*   **【ひらひら無限ピーマン】**：ピーマンを薄切りにして、ツナ缶と調味料で炒め煮するだけの簡単レシピです。ピーマンの苦みが和らぎ、いくらでも食べられるおいしさです。彩りも良く、栄養バランスも整います。\n*   **【大根とツナの和風サラダ】**：千切りにした大根とツナを、ポン酢ベースのドレッシングで和えるさっぱりとしたサラダです。トマト煮の濃厚さに合う、箸休めにぴったりな一品です。\n\n**スープの提案**\n*   **【レタスと卵の中華スープ】**：鶏ガラスープベースに、レタスとふんわり卵を合わせた優しい味わいのスープです。トマト煮の洋風な味付けとも相性が良く、簡単に作れます。\n*   **【キャベツとベーコンのコンソメスープ】**：キャベツとベーコンをコンソメで煮込んだ、シンプルな味わいのスープです。トマト煮との相性も良く、ホッと温まります。\n\nこの中から、気になる副菜とスープはありますか？それとも、他に何か好みがあれば教えてください。",
		},
		{
			Role:    frontendapi.ChatMessage_ROLE_USER,
			Content: "ひらひら無限ピーマンとレタスと卵の中華スープにします。",
		},
	}
	server.HandleConnectUnary(s,
		frontendapiconnect.FrontendServiceChatPlanProcedure,
		chatplan.NewHandler(genAI, firestore, search).ChatPlan,
		[]*frontendapi.ChatPlanRequest{
			{
				Messages: messagesEN[:1],
			},
			{
				Messages: messagesEN[:3],
			},
			{
				Messages: messagesEN[:5],
			},
			{
				Messages: messagesEN[:7],
			},
			{
				Messages: messagesJA[:1],
			},
			{
				Messages: messagesJA[:3],
			},
			{
				Messages: messagesJA[:5],
			},
			{
				Messages: messagesJA[:7],
			},
		})

	server.HandleConnectUnary(s,
		frontendapiconnect.FrontendServiceUpdatePlanProcedure,
		updateplan.NewHandler(genAI, firestore).UpdatePlan,
		[]*frontendapi.UpdatePlanRequest{
			{},
		})

	server.HandleConnectUnary(s,
		frontendapiconnect.FrontendServiceGetPlansProcedure,
		getplans.NewHandler(firestore).GetPlans,
		[]*frontendapi.GetPlansRequest{
			{},
		})

	server.HandleConnectUnary(s,
		frontendapiconnect.FrontendServiceGetPlanProcedure,
		getplan.NewHandler(firestore).GetPlan,
		[]*frontendapi.GetPlanRequest{
			{},
		})

	server.HandleConnectUnary(s,
		frontendapiconnect.FrontendServiceAddRecipeProcedure,
		addrecipe.NewHandler(firestore, storage, publicBucket).AddRecipe,
		[]*frontendapi.AddRecipeRequest{
			{
				Title:            "Test: 簡単・美味！トマトすき焼きパスタ",
				ServingSize:      "2人分",
				MainImageDataUrl: addRecipeStepImageURL,
				Ingredients: []*frontendapi.RecipeIngredient{
					{
						Name:     "パスタ",
						Quantity: "160~200g",
					},
					{
						Name:     "牛肉",
						Quantity: "150~200g",
					},
					{
						Name:     "ミニトマト",
						Quantity: "8~10個",
					},
					{
						Name:     "玉ねぎ",
						Quantity: "1/2個",
					},
					{
						Name:     "油（炒め用）",
						Quantity: "適量",
					},
				},
				AdditionalIngredients: []*frontendapi.IngredientSection{
					{
						Title: "割り下",
						Ingredients: []*frontendapi.RecipeIngredient{
							{
								Name:     "しょう油",
								Quantity: "大2~3",
							},
							{
								Name:     "みりん",
								Quantity: "大1.5~2",
							},
							{
								Name:     "砂糖",
								Quantity: "大1~1.5",
							},
							{
								Name:     "酒か水",
								Quantity: "大1~1.5",
							},
						},
					},
				},
				Steps: []*frontendapi.AddRecipeRequest_AddRecipeStep{
					{
						Description:  "材料を揃える。玉ねぎはくし切り、ミニトマトは半分に切っておく。割り下は混ぜておく。",
						ImageDataUrl: addRecipeStepImageURL,
					},
					{
						Description:  "材料を揃える。玉ねぎはくし切り、ミニトマトは半分に切っておく。割り下は混ぜておく。",
						ImageDataUrl: addRecipeStepImageURL,
					},
					{
						Description:  "材料を揃える。玉ねぎはくし切り、ミニトマトは半分に切っておく。割り下は混ぜておく。",
						ImageDataUrl: addRecipeStepImageURL,
					},
				},
			},
		})

	server.HandleConnectUnary(s,
		frontendapiconnect.FrontendServiceAddBookmarkProcedure,
		addbookmark.NewHandler(firestore).AddBookmark,
		[]*frontendapi.AddBookmarkRequest{
			{
				RecipeId: "02JNMi0W1605TLxzQt6v",
			},
		})

	server.HandleConnectUnary(s,
		frontendapiconnect.FrontendServiceRemoveBookmarkProcedure,
		removebookmark.NewHandler(firestore).RemoveBookmark,
		[]*frontendapi.RemoveBookmarkRequest{
			{
				RecipeId: "02JNMi0W1605TLxzQt6v",
			},
		})

	server.EnableDocsFirebaseAuth(s, "alpha.cookchat.curioswitch.org")

	if err := server.Start(ctx, s); err != nil {
		return fmt.Errorf("main: starting server: %w", err)
	}
	return nil
}
