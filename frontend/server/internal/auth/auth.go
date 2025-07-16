package auth

import (
	"context"
	"strings"

	"github.com/curioswitch/go-usegcp/middleware/firebaseauth"
)

// IsCurioSwitchUser checks if the user is a Curioswitch user based on their email.
// Additional debug functions will be enabled.
func IsCurioSwitchUser(ctx context.Context) bool {
	tok := firebaseauth.TokenFromContext(ctx)
	if id, ok := tok.Firebase.Identities["email"]; ok {
		if idAny, ok := id.([]any); ok && len(idAny) > 0 {
			if email, ok := idAny[0].(string); ok {
				return strings.HasSuffix(email, "@curioswitch.org")
			}
		}
	}
	return false
}
