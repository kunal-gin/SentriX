package notifications

import (
	"encoding/json"
	"net/http"
	"net/url"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/sentrix/server/internal/auth"
)

type channelListItem struct {
	ID        string    `json:"id"`
	Type      string    `json:"type"`
	Name      string    `json:"name"`
	Enabled   bool      `json:"enabled"`
	URL       string    `json:"url"`
	CreatedAt time.Time `json:"created_at"`
}

type createChannelRequest struct {
	Name string `json:"name"`
	Type string `json:"type"`
	URL  string `json:"url"`
}

// GET /api/v1/notifications/channels
func HandleListChannels(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, err := pool.Query(r.Context(), `
			SELECT
				id,
				type,
				name,
				enabled,
				COALESCE(config->>'url', '') AS url,
				created_at
			FROM notification_channels
			ORDER BY created_at DESC
		`)

		if err != nil {
			http.Error(w, "database query failed", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		channels := []channelListItem{}

		for rows.Next() {
			var channel channelListItem

			err := rows.Scan(
				&channel.ID,
				&channel.Type,
				&channel.Name,
				&channel.Enabled,
				&channel.URL,
				&channel.CreatedAt,
			)

			if err != nil {
				http.Error(w, "scan failed", http.StatusInternalServerError)
				return
			}

			channels = append(channels, channel)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(channels)
	}
}

// POST /api/v1/notifications/channels
func HandleCreateChannel(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req createChannelRequest

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid JSON", http.StatusBadRequest)
			return
		}

		if req.Name == "" {
			http.Error(w, "name is required", http.StatusBadRequest)
			return
		}

		if req.Type == "" {
			req.Type = "WEBHOOK"
		}

		if req.Type != "WEBHOOK" {
			http.Error(w, "only WEBHOOK channels are supported in V1", http.StatusBadRequest)
			return
		}

		if req.URL == "" {
			http.Error(w, "url is required", http.StatusBadRequest)
			return
		}

		parsedURL, err := url.Parse(req.URL)
		if err != nil {
			http.Error(w, "invalid url", http.StatusBadRequest)
			return
		}

		if parsedURL.Scheme != "http" && parsedURL.Scheme != "https" {
			http.Error(w, "url must be http or https", http.StatusBadRequest)
			return
		}

		config := map[string]string{
			"url": req.URL,
		}

		configJSON, err := json.Marshal(config)
		if err != nil {
			http.Error(w, "invalid configuration", http.StatusInternalServerError)
			return
		}

		id := uuid.New()

		_, err = pool.Exec(r.Context(), `
			INSERT INTO notification_channels (
				id,
				type,
				name,
				enabled,
				config
			) VALUES (
				$1, $2, $3, TRUE, $4
			)
		`, id, req.Type, req.Name, configJSON)

		if err != nil {
			http.Error(w, "database insert failed", http.StatusInternalServerError)
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
			"notification_channel.create",
			"notification_channel",
			id.String(),
			auth.ClientIP(r),
			map[string]any{
				"name": req.Name,
				"type": req.Type,
			},
		)

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]string{
			"id": id.String(),
		})
	}
}

// DELETE /api/v1/notifications/channels/{channelID}
func HandleDeleteChannel(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		channelID := chi.URLParam(r, "channelID")

		_, err := pool.Exec(r.Context(), `
			DELETE FROM notification_channels
			WHERE id = $1
		`, channelID)

		if err != nil {
			http.Error(w, "database delete failed", http.StatusInternalServerError)
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
			"notification_channel.delete",
			"notification_channel",
			channelID,
			auth.ClientIP(r),
			nil,
		)

		w.WriteHeader(http.StatusNoContent)
	}
}

// GET /api/v1/notifications/jobs
func HandleListJobs(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, err := pool.Query(r.Context(), `
			SELECT
				id,
				channel_id,
				event_type,
				status,
				attempts,
				max_attempts,
				last_error,
				next_attempt_at,
				created_at
			FROM notification_jobs
			ORDER BY created_at DESC
			LIMIT 100
		`)

		if err != nil {
			http.Error(w, "database query failed", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type jobListItem struct {
			ID            string    `json:"id"`
			ChannelID     string    `json:"channel_id"`
			EventType     string    `json:"event_type"`
			Status        string    `json:"status"`
			Attempts      int       `json:"attempts"`
			MaxAttempts   int       `json:"max_attempts"`
			LastError     *string   `json:"last_error"`
			NextAttemptAt time.Time `json:"next_attempt_at"`
			CreatedAt     time.Time `json:"created_at"`
		}

		jobs := []jobListItem{}

		for rows.Next() {
			var job jobListItem

			err := rows.Scan(
				&job.ID,
				&job.ChannelID,
				&job.EventType,
				&job.Status,
				&job.Attempts,
				&job.MaxAttempts,
				&job.LastError,
				&job.NextAttemptAt,
				&job.CreatedAt,
			)

			if err != nil {
				http.Error(w, "scan failed", http.StatusInternalServerError)
				return
			}

			jobs = append(jobs, job)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(jobs)
	}
}
