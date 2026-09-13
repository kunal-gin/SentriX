package auth

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

func ClientIP(r *http.Request) string {
	forwarded := r.Header.Get("X-Forwarded-For")
	if forwarded != "" {
		parts := strings.Split(forwarded, ",")
		return strings.TrimSpace(parts[0])
	}

	return r.RemoteAddr
}

func WriteAudit(
	ctx context.Context,
	pool *pgxpool.Pool,
	actorID *string,
	action string,
	resourceType string,
	resourceID string,
	ip string,
	details map[string]any,
) {
	if details == nil {
		details = map[string]any{}
	}

	detailsJSON, err := json.Marshal(details)
	if err != nil {
		detailsJSON = []byte("{}")
	}

	_, err = pool.Exec(ctx, `
		INSERT INTO audit_logs (
			actor_id,
			action,
			resource_type,
			resource_id,
			ip_address,
			details
		) VALUES (
			$1, $2, $3, $4, $5, $6
		)
	`, actorID, action, resourceType, resourceID, ip, detailsJSON)

	if err != nil {
		slog.Error("failed to write audit log", "action", action, "error", err)
	}
}
