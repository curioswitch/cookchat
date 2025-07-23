package i18n

import (
	"context"
	"net/http"
	"strings"
)

type userLanguageContextKey struct{}

var userLanguageContextKeyInstance = userLanguageContextKey{}

func Middleware() func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := r.Context()

			lng := r.Header.Get("Accept-Language")
			lng, _, _ = strings.Cut(lng, ",")
			lng = strings.TrimSpace(lng)

			if lng != "" {
				ctx = context.WithValue(ctx, userLanguageContextKeyInstance, lng)
				r = r.WithContext(ctx)
			}

			next.ServeHTTP(w, r)
		})
	}
}

func UserLanguage(ctx context.Context) string {
	if lng, ok := ctx.Value(userLanguageContextKeyInstance).(string); ok {
		return lng
	}
	return ""
}
