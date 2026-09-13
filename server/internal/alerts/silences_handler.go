package alerts

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Silence struct {
	ID         string     `json:"id"`
	ServerID   *string    `json:"server_id,omitempty"`
	ServerName *string    `json:"server_name,omitempty"`
	RuleID     *string    `json:"rule_id,omitempty"`
	RuleName   *string    `json:"rule_name,omitempty"`
	Reason     string     `json:"reason"`
	StartsAt   time.Time  `json:"starts_at"`
	EndsAt     time.Time  `json:"ends_at"`
	CreatedAt  time.Time  `json:"created_at"`
	Active     bool       `json:"active"`
}

type CreateSilenceRequest struct {
	ServerID        *string    `json:"server_id,omitempty"`
	RuleID          *string    `json:"rule_id,omitempty"`
	Reason          string     `json:"reason"`
	DurationMinutes int        `json:"duration_minutes"`
	StartsAt        *time.Time `json:"starts_at,omitempty"`
	EndsAt          *time.Time `json:"ends_at,omitempty"`
}

// IsSilenced checks if a server or rule is currently muted by an active silence window.
func IsSilenced(ctx context.Context, pool *pgxpool.Pool, serverID, ruleID string) bool {
	var exists bool
	now := time.Now()

	err := pool.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM silences
			WHERE starts_at <= $1 AND ends_at >= $1
			  AND (
			    (server_id IS NULL AND rule_id IS NULL)
			    OR (server_id = $2 AND rule_id IS NULL)
			    OR (server_id IS NULL AND rule_id = $3)
			    OR (server_id = $2 AND rule_id = $3)
			  )
		)
	`, now, serverID, ruleID).Scan(&exists)

	return err == nil && exists
}

// GET /api/v1/silences
func HandleListSilences(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		query := `
			SELECT
				s.id,
				s.server_id,
				srv.name,
				s.rule_id,
				r.name,
				s.reason,
				s.starts_at,
				s.ends_at,
				s.created_at
			FROM silences s
			LEFT JOIN servers srv ON srv.id = s.server_id
			LEFT JOIN alert_rules r ON r.id = s.rule_id
			ORDER BY s.ends_at DESC
		`

		rows, err := pool.Query(r.Context(), query)
		if err != nil {
			http.Error(w, "failed to query silences", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		now := time.Now()
		silences := make([]Silence, 0)
		for rows.Next() {
			var s Silence
			err := rows.Scan(
				&s.ID,
				&s.ServerID,
				&s.ServerName,
				&s.RuleID,
				&s.RuleName,
				&s.Reason,
				&s.StartsAt,
				&s.EndsAt,
				&s.CreatedAt,
			)
			if err != nil {
				continue
			}

			s.Active = s.StartsAt.Before(now) && s.EndsAt.After(now)
			silences = append(silences, s)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(silences)
	}
}

// POST /api/v1/silences
func HandleCreateSilence(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req CreateSilenceRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}

		now := time.Now()
		startsAt := now
		if req.StartsAt != nil && !req.StartsAt.IsZero() {
			startsAt = *req.StartsAt
		}

		var endsAt time.Time
		if req.EndsAt != nil && !req.EndsAt.IsZero() {
			endsAt = *req.EndsAt
		} else if req.DurationMinutes > 0 {
			endsAt = startsAt.Add(time.Duration(req.DurationMinutes) * time.Minute)
		} else {
			endsAt = startsAt.Add(60 * time.Minute) // default 1 hour
		}

		reason := req.Reason
		if reason == "" {
			reason = "Scheduled maintenance"
		}

		var id string
		err := pool.QueryRow(r.Context(), `
			INSERT INTO silences (server_id, rule_id, reason, starts_at, ends_at)
			VALUES ($1, $2, $3, $4, $5)
			RETURNING id
		`, req.ServerID, req.RuleID, reason, startsAt, endsAt).Scan(&id)

		if err != nil {
			http.Error(w, "failed to create silence", http.StatusInternalServerError)
			return
		}

		silence := Silence{
			ID:       id,
			ServerID: req.ServerID,
			RuleID:   req.RuleID,
			Reason:   reason,
			StartsAt: startsAt,
			EndsAt:   endsAt,
			Active:   startsAt.Before(now) && endsAt.After(now),
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(silence)
	}
}

// DELETE /api/v1/silences/{silenceID}
func HandleDeleteSilence(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		silenceID := chi.URLParam(r, "silenceID")
		if silenceID == "" {
			http.Error(w, "missing silence ID", http.StatusBadRequest)
			return
		}

		_, err := pool.Exec(r.Context(), "DELETE FROM silences WHERE id = $1", silenceID)
		if err != nil {
			http.Error(w, "failed to delete silence", http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}
