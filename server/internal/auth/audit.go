package auth

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type AuditLogEntry struct {
	ID           string         `json:"id"`
	ActorID      *string        `json:"actor_id,omitempty"`
	ActorEmail   *string        `json:"actor_email,omitempty"`
	Action       string         `json:"action"`
	ResourceType *string        `json:"resource_type,omitempty"`
	ResourceID   *string        `json:"resource_id,omitempty"`
	IPAddress    *string        `json:"ip_address,omitempty"`
	Details      map[string]any `json:"details"`
	CreatedAt    time.Time      `json:"created_at"`
}

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

// HandleGetAuditLogs returns paginated audit log entries with actor details.
func HandleGetAuditLogs(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		limit := 50
		if l := r.URL.Query().Get("limit"); l != "" {
			if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 200 {
				limit = parsed
			}
		}

		actionFilter := r.URL.Query().Get("action")

		query := `
			SELECT
				a.id,
				a.actor_id,
				u.email,
				a.action,
				a.resource_type,
				a.resource_id,
				a.ip_address,
				a.details,
				a.created_at
			FROM audit_logs a
			LEFT JOIN users u ON u.id = a.actor_id
			WHERE ($1 = '' OR a.action = $1)
			ORDER BY a.created_at DESC
			LIMIT $2
		`

		rows, err := pool.Query(r.Context(), query, actionFilter, limit)
		if err != nil {
			http.Error(w, "failed to query audit logs", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		entries := make([]AuditLogEntry, 0)
		for rows.Next() {
			var e AuditLogEntry
			var detailsRaw []byte

			err := rows.Scan(
				&e.ID,
				&e.ActorID,
				&e.ActorEmail,
				&e.Action,
				&e.ResourceType,
				&e.ResourceID,
				&e.IPAddress,
				&detailsRaw,
				&e.CreatedAt,
			)
			if err != nil {
				continue
			}

			e.Details = make(map[string]any)
			if len(detailsRaw) > 0 {
				_ = json.Unmarshal(detailsRaw, &e.Details)
			}

			entries = append(entries, e)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(entries)
	}
}
