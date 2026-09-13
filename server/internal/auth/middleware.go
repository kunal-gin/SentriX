package auth

import (
	"context"
	"net/http"
)

type contextKey int

const userContextKey contextKey = 0

type AuthUser struct {
	ID    string
	Email string
	Role  string
}

func RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")

		if len(authHeader) < 7 || authHeader[:7] != "Bearer " {
			http.Error(w, "missing bearer token", http.StatusUnauthorized)
			return
		}

		tokenString := authHeader[7:]

		claims, err := ValidateAccessToken(tokenString)
		if err != nil {
			http.Error(w, "invalid or expired token", http.StatusUnauthorized)
			return
		}

		user := AuthUser{
			ID:    claims.Subject,
			Email: claims.Email,
			Role:  claims.Role,
		}

		ctx := context.WithValue(r.Context(), userContextKey, user)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func GetUser(r *http.Request) *AuthUser {
	value := r.Context().Value(userContextKey)
	if value == nil {
		return nil
	}

	user, ok := value.(AuthUser)
	if !ok {
		return nil
	}

	return &user
}

func RequireRole(roles ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user := GetUser(r)

			if user == nil {
				http.Error(w, "unauthorized", http.StatusUnauthorized)
				return
			}

			allowed := false
			for _, role := range roles {
				if user.Role == role {
					allowed = true
					break
				}
			}

			if !allowed {
				http.Error(w, "forbidden", http.StatusForbidden)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
