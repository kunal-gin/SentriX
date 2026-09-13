package agents

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/sentrix/server/internal/auth"
)

type AgentListItem struct {
	ID                  string     `json:"id"`
	Name                string     `json:"name"`
	Status              string     `json:"status"`
	CreatedAt           time.Time  `json:"created_at"`
	CredentialRotatedAt *time.Time `json:"credential_rotated_at"`
	RevokedAt           *time.Time `json:"revoked_at"`
	ServerID            *string    `json:"server_id"`
	ServerName          *string    `json:"server_name"`
	LastSeenAt          *time.Time `json:"last_seen_at"`
}

// GET /api/v1/agents
func HandleListAgents(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, err := pool.Query(r.Context(), `
			SELECT
				a.id,
				a.name,
				a.status,
				a.created_at,
				a.credential_rotated_at,
				a.revoked_at,
				s.id,
				s.name,
				s.last_seen_at
			FROM agents a
			LEFT JOIN servers s ON s.agent_id = a.id
			ORDER BY a.created_at DESC
			LIMIT 200
		`)

		if err != nil {
			http.Error(w, "database query failed", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		items := []AgentListItem{}

		for rows.Next() {
			var item AgentListItem

			err := rows.Scan(
				&item.ID,
				&item.Name,
				&item.Status,
				&item.CreatedAt,
				&item.CredentialRotatedAt,
				&item.RevokedAt,
				&item.ServerID,
				&item.ServerName,
				&item.LastSeenAt,
			)

			if err != nil {
				http.Error(w, "scan failed", http.StatusInternalServerError)
				return
			}

			items = append(items, item)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(items)
	}
}

// POST /api/v1/agents/{agentID}/rotate-credential
func HandleRotateCredential(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		agentID := chi.URLParam(r, "agentID")

		newCredential, err := generateRawToken("agtc")
		if err != nil {
			http.Error(w, "failed to generate credential", http.StatusInternalServerError)
			return
		}

		newHash := hashToken(newCredential)

		var agentName string

		err = pool.QueryRow(r.Context(), `
			UPDATE agents
			SET
				credential_hash = $2,
				credential_rotated_at = NOW(),
				status = 'ACTIVE',
				revoked_at = NULL
			WHERE id = $1
			RETURNING name
		`, agentID, newHash).Scan(&agentName)

		if err == pgx.ErrNoRows {
			http.Error(w, "agent not found", http.StatusNotFound)
			return
		}

		if err != nil {
			http.Error(w, "database update failed", http.StatusInternalServerError)
			return
		}

		actor := auth.GetUser(r)
		var actorID *string
		if actor != nil {
			actorID = &actor.ID
		}

		auth.WriteAudit(
			r.Context(),
			pool,
			actorID,
			"agent.rotate_credential",
			"agent",
			agentID,
			auth.ClientIP(r),
			map[string]any{
				"agent_name": agentName,
			},
		)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"agent_id":   agentID,
			"credential": newCredential,
		})
	}
}

// POST /api/v1/agents/{agentID}/revoke
func HandleRevokeAgent(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		agentID := chi.URLParam(r, "agentID")

		var agentName string

		err := pool.QueryRow(r.Context(), `
			UPDATE agents
			SET
				status = 'REVOKED',
				revoked_at = NOW()
			WHERE id = $1
			RETURNING name
		`, agentID).Scan(&agentName)

		if err == pgx.ErrNoRows {
			http.Error(w, "agent not found", http.StatusNotFound)
			return
		}

		if err != nil {
			http.Error(w, "database update failed", http.StatusInternalServerError)
			return
		}

		actor := auth.GetUser(r)
		var actorID *string
		if actor != nil {
			actorID = &actor.ID
		}

		auth.WriteAudit(
			r.Context(),
			pool,
			actorID,
			"agent.revoke",
			"agent",
			agentID,
			auth.ClientIP(r),
			map[string]any{
				"agent_name": agentName,
			},
		)

		w.WriteHeader(http.StatusNoContent)
	}
}
