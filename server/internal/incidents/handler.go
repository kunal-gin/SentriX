package incidents

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/sentrix/server/internal/auth"
	"github.com/sentrix/server/internal/realtime"
)

type IncidentListItem struct {
	ID             string     `json:"id"`
	ServerID       string     `json:"server_id"`
	ServerName     string     `json:"server_name"`
	Title          string     `json:"title"`
	Severity       string     `json:"severity"`
	Status         string     `json:"status"`
	StartedAt      time.Time  `json:"started_at"`
	AcknowledgedAt *time.Time `json:"acknowledged_at"`
	ResolvedAt     *time.Time `json:"resolved_at"`
}

type IncidentComment struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	UserEmail *string   `json:"user_email"`
	Body      string    `json:"body"`
	CreatedAt time.Time `json:"created_at"`
}

type IncidentTimelineEvent struct {
	ID         string    `json:"id"`
	EventType  string    `json:"event_type"`
	Message    string    `json:"message"`
	ActorID    *string   `json:"actor_id"`
	ActorEmail *string   `json:"actor_email"`
	CreatedAt  time.Time `json:"created_at"`
}

type IncidentDetail struct {
	ID             string                  `json:"id"`
	ServerID       string                  `json:"server_id"`
	ServerName     string                  `json:"server_name"`
	Title          string                  `json:"title"`
	Severity       string                  `json:"severity"`
	Status         string                  `json:"status"`
	StartedAt      time.Time               `json:"started_at"`
	AcknowledgedAt *time.Time              `json:"acknowledged_at"`
	ResolvedAt     *time.Time              `json:"resolved_at"`
	AcknowledgedBy *string                 `json:"acknowledged_by"`
	ResolvedBy     *string                 `json:"resolved_by"`
	RootAlertID    *string                 `json:"root_alert_id"`
	RootCheckID    *string                 `json:"root_check_id"`
	Summary        *string                 `json:"summary"`
	Comments       []IncidentComment       `json:"comments"`
	Timeline       []IncidentTimelineEvent `json:"timeline"`
}

// GET /api/v1/incidents?status=open|all|resolved
func HandleListIncidents(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		status := r.URL.Query().Get("status")

		query := `
			SELECT
				i.id,
				i.server_id,
				s.name,
				i.title,
				i.severity,
				i.status,
				i.started_at,
				i.acknowledged_at,
				i.resolved_at
			FROM incidents i
			JOIN servers s ON s.id = i.server_id
		`

		switch status {
		case "open":
			query += `
				WHERE i.status IN ('OPEN', 'ACKNOWLEDGED', 'INVESTIGATING')
			`
		case "resolved":
			query += `
				WHERE i.status = 'RESOLVED'
			`
		default:
			// all
		}

		query += `
			ORDER BY i.started_at DESC
			LIMIT 100
		`

		rows, err := pool.Query(r.Context(), query)
		if err != nil {
			http.Error(w, "database query failed", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		items := []IncidentListItem{}

		for rows.Next() {
			var item IncidentListItem

			err := rows.Scan(
				&item.ID,
				&item.ServerID,
				&item.ServerName,
				&item.Title,
				&item.Severity,
				&item.Status,
				&item.StartedAt,
				&item.AcknowledgedAt,
				&item.ResolvedAt,
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

// GET /api/v1/incidents/{incidentID}
func HandleGetIncident(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		incidentID := chi.URLParam(r, "incidentID")

		var detail IncidentDetail

		err := pool.QueryRow(r.Context(), `
			SELECT
				i.id,
				i.server_id,
				s.name,
				i.title,
				i.severity,
				i.status,
				i.started_at,
				i.acknowledged_at,
				i.resolved_at,
				i.acknowledged_by,
				i.resolved_by,
				i.root_alert_id,
				i.root_check_id,
				i.summary
			FROM incidents i
			JOIN servers s ON s.id = i.server_id
			WHERE i.id = $1
		`, incidentID).Scan(
			&detail.ID,
			&detail.ServerID,
			&detail.ServerName,
			&detail.Title,
			&detail.Severity,
			&detail.Status,
			&detail.StartedAt,
			&detail.AcknowledgedAt,
			&detail.ResolvedAt,
			&detail.AcknowledgedBy,
			&detail.ResolvedBy,
			&detail.RootAlertID,
			&detail.RootCheckID,
			&detail.Summary,
		)

		if err == pgx.ErrNoRows {
			http.Error(w, "incident not found", http.StatusNotFound)
			return
		}

		if err != nil {
			http.Error(w, "database query failed", http.StatusInternalServerError)
			return
		}

		detail.Comments = []IncidentComment{}
		detail.Timeline = []IncidentTimelineEvent{}

		commentRows, err := pool.Query(r.Context(), `
			SELECT
				c.id,
				c.user_id,
				u.email,
				c.body,
				c.created_at
			FROM incident_comments c
			LEFT JOIN users u ON u.id = c.user_id
			WHERE c.incident_id = $1
			ORDER BY c.created_at ASC
		`, incidentID)

		if err != nil {
			http.Error(w, "database query failed", http.StatusInternalServerError)
			return
		}
		defer commentRows.Close()

		for commentRows.Next() {
			var comment IncidentComment

			err := commentRows.Scan(
				&comment.ID,
				&comment.UserID,
				&comment.UserEmail,
				&comment.Body,
				&comment.CreatedAt,
			)

			if err != nil {
				http.Error(w, "scan failed", http.StatusInternalServerError)
				return
			}

			detail.Comments = append(detail.Comments, comment)
		}

		timelineRows, err := pool.Query(r.Context(), `
			SELECT
				t.id,
				t.event_type,
				t.message,
				t.actor_id,
				u.email,
				t.created_at
			FROM incident_timeline_events t
			LEFT JOIN users u ON u.id = t.actor_id
			WHERE t.incident_id = $1
			ORDER BY t.created_at ASC
		`, incidentID)

		if err != nil {
			http.Error(w, "database query failed", http.StatusInternalServerError)
			return
		}
		defer timelineRows.Close()

		for timelineRows.Next() {
			var event IncidentTimelineEvent

			err := timelineRows.Scan(
				&event.ID,
				&event.EventType,
				&event.Message,
				&event.ActorID,
				&event.ActorEmail,
				&event.CreatedAt,
			)

			if err != nil {
				http.Error(w, "scan failed", http.StatusInternalServerError)
				return
			}

			detail.Timeline = append(detail.Timeline, event)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(detail)
	}
}

// POST /api/v1/incidents/{incidentID}/ack
func HandleAcknowledge(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		incidentID := chi.URLParam(r, "incidentID")

		actor := auth.GetUser(r)
		if actor == nil {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		var req struct {
			Message string `json:"message"`
		}

		_ = json.NewDecoder(r.Body).Decode(&req)
		note := strings.TrimSpace(req.Message)

		ctx := r.Context()

		tx, err := pool.Begin(ctx)
		if err != nil {
			http.Error(w, "database error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(ctx)

		var serverID string
		var title string

		err = tx.QueryRow(ctx, `
			UPDATE incidents
			SET
				status = 'ACKNOWLEDGED',
				acknowledged_at = NOW(),
				acknowledged_by = $2
			WHERE id = $1
			  AND status = 'OPEN'
			RETURNING server_id, title
		`, incidentID, actor.ID).Scan(&serverID, &title)

		if err == pgx.ErrNoRows {
			var currentStatus string

			err := tx.QueryRow(ctx, `
				SELECT status
				FROM incidents
				WHERE id = $1
			`, incidentID).Scan(&currentStatus)

			if err != nil {
				http.Error(w, "incident not found", http.StatusNotFound)
				return
			}

			http.Error(w, "incident cannot be acknowledged from status "+currentStatus, http.StatusConflict)
			return
		}

		if err != nil {
			http.Error(w, "database update failed", http.StatusInternalServerError)
			return
		}

		err = WriteTimelineTx(
			ctx,
			tx,
			incidentID,
			&actor.ID,
			"ACKNOWLEDGED",
			"Incident acknowledged by "+actor.Email,
		)

		if err != nil {
			http.Error(w, "failed to write timeline event", http.StatusInternalServerError)
			return
		}

		if note != "" {
			err = addCommentTx(ctx, tx, incidentID, actor.ID, note)
			if err != nil {
				http.Error(w, "failed to add comment", http.StatusInternalServerError)
				return
			}
		}

		if err := tx.Commit(ctx); err != nil {
			http.Error(w, "database error", http.StatusInternalServerError)
			return
		}

		auth.WriteAudit(
			ctx,
			pool,
			&actor.ID,
			"incident.acknowledge",
			"incident",
			incidentID,
			auth.ClientIP(r),
			map[string]any{
				"title": title,
			},
		)

		realtime.PublishIncidentUpdated(incidentID, serverID)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"status": "ACKNOWLEDGED",
		})
	}
}

// POST /api/v1/incidents/{incidentID}/resolve
func HandleResolve(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		incidentID := chi.URLParam(r, "incidentID")

		actor := auth.GetUser(r)
		if actor == nil {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		var req struct {
			Message string `json:"message"`
		}

		_ = json.NewDecoder(r.Body).Decode(&req)
		note := strings.TrimSpace(req.Message)

		ctx := r.Context()

		tx, err := pool.Begin(ctx)
		if err != nil {
			http.Error(w, "database error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(ctx)

		var serverID string
		var title string

		err = tx.QueryRow(ctx, `
			UPDATE incidents
			SET
				status = 'RESOLVED',
				resolved_at = NOW(),
				resolved_by = $2
			WHERE id = $1
			  AND status IN ('OPEN', 'ACKNOWLEDGED', 'INVESTIGATING')
			RETURNING server_id, title
		`, incidentID, actor.ID).Scan(&serverID, &title)

		if err == pgx.ErrNoRows {
			var currentStatus string

			err := tx.QueryRow(ctx, `
				SELECT status
				FROM incidents
				WHERE id = $1
			`, incidentID).Scan(&currentStatus)

			if err != nil {
				http.Error(w, "incident not found", http.StatusNotFound)
				return
			}

			http.Error(w, "incident cannot be resolved from status "+currentStatus, http.StatusConflict)
			return
		}

		if err != nil {
			http.Error(w, "database update failed", http.StatusInternalServerError)
			return
		}

		err = WriteTimelineTx(
			ctx,
			tx,
			incidentID,
			&actor.ID,
			"RESOLVED",
			"Incident manually resolved by "+actor.Email,
		)

		if err != nil {
			http.Error(w, "failed to write timeline event", http.StatusInternalServerError)
			return
		}

		if note != "" {
			err = addCommentTx(ctx, tx, incidentID, actor.ID, note)
			if err != nil {
				http.Error(w, "failed to add comment", http.StatusInternalServerError)
				return
			}
		}

		if err := tx.Commit(ctx); err != nil {
			http.Error(w, "database error", http.StatusInternalServerError)
			return
		}

		auth.WriteAudit(
			ctx,
			pool,
			&actor.ID,
			"incident.resolve",
			"incident",
			incidentID,
			auth.ClientIP(r),
			map[string]any{
				"title": title,
			},
		)

		realtime.PublishIncidentUpdated(incidentID, serverID)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"status": "RESOLVED",
		})
	}
}

// POST /api/v1/incidents/{incidentID}/comments
func HandleAddComment(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		incidentID := chi.URLParam(r, "incidentID")

		actor := auth.GetUser(r)
		if actor == nil {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		var req struct {
			Body string `json:"body"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid JSON", http.StatusBadRequest)
			return
		}

		body := strings.TrimSpace(req.Body)

		if body == "" {
			http.Error(w, "comment body is required", http.StatusBadRequest)
			return
		}

		if len(body) > 2000 {
			http.Error(w, "comment body too long", http.StatusBadRequest)
			return
		}

		ctx := r.Context()

		tx, err := pool.Begin(ctx)
		if err != nil {
			http.Error(w, "database error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(ctx)

		var serverID string

		err = tx.QueryRow(ctx, `
			SELECT server_id
			FROM incidents
			WHERE id = $1
		`, incidentID).Scan(&serverID)

		if err != nil {
			http.Error(w, "incident not found", http.StatusNotFound)
			return
		}

		err = addCommentTx(ctx, tx, incidentID, actor.ID, body)
		if err != nil {
			http.Error(w, "failed to add comment", http.StatusInternalServerError)
			return
		}

		if err := tx.Commit(ctx); err != nil {
			http.Error(w, "database error", http.StatusInternalServerError)
			return
		}

		auth.WriteAudit(
			ctx,
			pool,
			&actor.ID,
			"incident.comment",
			"incident",
			incidentID,
			auth.ClientIP(r),
			nil,
		)

		realtime.PublishIncidentUpdated(incidentID, serverID)

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]string{
			"status": "comment_added",
		})
	}
}

func addCommentTx(
	ctx context.Context,
	tx pgx.Tx,
	incidentID string,
	userID string,
	body string,
) error {
	_, err := tx.Exec(ctx, `
		INSERT INTO incident_comments (
			incident_id,
			user_id,
			body
		) VALUES (
			$1, $2, $3
		)
	`, incidentID, userID, body)

	if err != nil {
		return err
	}

	return WriteTimelineTx(
		ctx,
		tx,
		incidentID,
		&userID,
		"COMMENT",
		body,
	)
}
