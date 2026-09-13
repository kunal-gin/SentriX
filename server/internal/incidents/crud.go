package incidents

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/sentrix/server/internal/api"
	"github.com/sentrix/server/internal/auth"
	"github.com/sentrix/server/internal/realtime"
)

type CreateIncidentRequest struct {
	ServerID    string `json:"server_id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Severity    string `json:"severity"` // CRITICAL, WARNING, INFO
}

type UpdateIncidentRequest struct {
	Title        *string `json:"title"`
	Severity     *string `json:"severity"`
	AssigneeID   *string `json:"assignee_id"`
	AssigneeName *string `json:"assignee_name"`
	Summary      *string `json:"summary"`
	Status       *string `json:"status"`
}

type PostmortemRequest struct {
	Postmortem    string `json:"postmortem"`
	RCAHypothesis string `json:"rca_hypothesis"`
}

// POST /api/v1/incidents
func HandleCreateIncident(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		actor := auth.GetUser(r)
		if actor == nil {
			api.RespondError(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication required")
			return
		}

		var req CreateIncidentRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			api.RespondError(w, r, http.StatusBadRequest, "INVALID_BODY", "Invalid JSON payload")
			return
		}

		req.Title = strings.TrimSpace(req.Title)
		if req.Title == "" {
			api.RespondError(w, r, http.StatusBadRequest, "REQUIRED_FIELD", "Incident title is required")
			return
		}
		if req.Severity == "" {
			req.Severity = "WARNING"
		}

		ctx := r.Context()
		incidentID := uuid.New()

		// Verify server exists
		var serverName string
		err := pool.QueryRow(ctx, `SELECT name FROM servers WHERE id = $1`, req.ServerID).Scan(&serverName)
		if err != nil {
			api.RespondError(w, r, http.StatusBadRequest, "SERVER_NOT_FOUND", "Target server does not exist")
			return
		}

		tx, err := pool.Begin(ctx)
		if err != nil {
			api.RespondError(w, r, http.StatusInternalServerError, "DB_ERROR", "Failed to start database transaction")
			return
		}
		defer tx.Rollback(ctx)

		_, err = tx.Exec(ctx, `
			INSERT INTO incidents (
				id,
				server_id,
				title,
				severity,
				status,
				started_at,
				summary
			) VALUES ($1, $2, $3, $4, 'OPEN', NOW(), $5)
		`, incidentID, req.ServerID, req.Title, req.Severity, req.Description)
		if err != nil {
			api.RespondError(w, r, http.StatusInternalServerError, "DB_INSERT_FAILED", "Failed to insert incident")
			return
		}

		err = WriteTimelineTx(ctx, tx, incidentID.String(), &actor.ID, "OPENED", "Manual incident created by "+actor.Email+": "+req.Title)
		if err != nil {
			api.RespondError(w, r, http.StatusInternalServerError, "TIMELINE_FAILED", "Failed to write timeline event")
			return
		}

		if err := tx.Commit(ctx); err != nil {
			api.RespondError(w, r, http.StatusInternalServerError, "DB_COMMIT_FAILED", "Failed to commit incident transaction")
			return
		}

		auth.WriteAudit(ctx, pool, &actor.ID, "incident.create", "incident", incidentID.String(), auth.ClientIP(r), map[string]any{
			"title":    req.Title,
			"severity": req.Severity,
			"server":   serverName,
		})

		realtime.PublishIncidentUpdated(incidentID.String(), req.ServerID)

		api.RespondJSON(w, http.StatusCreated, map[string]any{
			"id":          incidentID.String(),
			"server_id":   req.ServerID,
			"server_name": serverName,
			"title":       req.Title,
			"severity":    req.Severity,
			"status":      "OPEN",
			"started_at":  time.Now().UTC(),
		})
	}
}

// PATCH /api/v1/incidents/{incidentID}
func HandleUpdateIncident(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		incidentID := chi.URLParam(r, "incidentID")
		actor := auth.GetUser(r)
		if actor == nil {
			api.RespondError(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication required")
			return
		}

		var req UpdateIncidentRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			api.RespondError(w, r, http.StatusBadRequest, "INVALID_BODY", "Invalid JSON payload")
			return
		}

		ctx := r.Context()
		tx, err := pool.Begin(ctx)
		if err != nil {
			api.RespondError(w, r, http.StatusInternalServerError, "DB_ERROR", "Transaction failed")
			return
		}
		defer tx.Rollback(ctx)

		var serverID string
		err = tx.QueryRow(ctx, `SELECT server_id FROM incidents WHERE id = $1`, incidentID).Scan(&serverID)
		if err != nil {
			api.RespondError(w, r, http.StatusNotFound, "INCIDENT_NOT_FOUND", "Incident not found")
			return
		}

		if req.AssigneeName != nil {
			_, _ = tx.Exec(ctx, `UPDATE incidents SET assignee_name = $2, updated_at = NOW() WHERE id = $1`, incidentID, *req.AssigneeName)
			_ = WriteTimelineTx(ctx, tx, incidentID, &actor.ID, "SYSTEM", "Assignee changed to "+*req.AssigneeName)
		}
		if req.Severity != nil {
			_, _ = tx.Exec(ctx, `UPDATE incidents SET severity = $2, updated_at = NOW() WHERE id = $1`, incidentID, *req.Severity)
			_ = WriteTimelineTx(ctx, tx, incidentID, &actor.ID, "SYSTEM", "Severity updated to "+*req.Severity)
		}
		if req.Title != nil {
			_, _ = tx.Exec(ctx, `UPDATE incidents SET title = $2, updated_at = NOW() WHERE id = $1`, incidentID, *req.Title)
		}

		if err := tx.Commit(ctx); err != nil {
			api.RespondError(w, r, http.StatusInternalServerError, "DB_ERROR", "Commit failed")
			return
		}

		realtime.PublishIncidentUpdated(incidentID, serverID)
		api.RespondJSON(w, http.StatusOK, map[string]string{"status": "updated"})
	}
}

// POST /api/v1/incidents/{incidentID}/investigate
func HandleInvestigate(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		incidentID := chi.URLParam(r, "incidentID")
		actor := auth.GetUser(r)
		if actor == nil {
			api.RespondError(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication required")
			return
		}

		ctx := r.Context()
		tx, err := pool.Begin(ctx)
		if err != nil {
			api.RespondError(w, r, http.StatusInternalServerError, "DB_ERROR", "Transaction failed")
			return
		}
		defer tx.Rollback(ctx)

		var serverID string
		err = tx.QueryRow(ctx, `
			UPDATE incidents
			SET status = 'INVESTIGATING', updated_at = NOW()
			WHERE id = $1
			RETURNING server_id
		`, incidentID).Scan(&serverID)
		if err != nil {
			if err == pgx.ErrNoRows {
				api.RespondError(w, r, http.StatusNotFound, "NOT_FOUND", "Incident not found")
				return
			}
			api.RespondError(w, r, http.StatusInternalServerError, "DB_ERROR", "Update failed")
			return
		}

		_ = WriteTimelineTx(ctx, tx, incidentID, &actor.ID, "INVESTIGATING", "Active investigation initiated by "+actor.Email)

		if err := tx.Commit(ctx); err != nil {
			api.RespondError(w, r, http.StatusInternalServerError, "DB_ERROR", "Commit failed")
			return
		}

		realtime.PublishIncidentUpdated(incidentID, serverID)
		api.RespondJSON(w, http.StatusOK, map[string]string{"status": "INVESTIGATING"})
	}
}

// POST /api/v1/incidents/{incidentID}/postmortem
func HandleSavePostmortem(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		incidentID := chi.URLParam(r, "incidentID")
		actor := auth.GetUser(r)
		if actor == nil {
			api.RespondError(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication required")
			return
		}

		var req PostmortemRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			api.RespondError(w, r, http.StatusBadRequest, "INVALID_BODY", "Invalid JSON payload")
			return
		}

		ctx := r.Context()
		_, err := pool.Exec(ctx, `
			UPDATE incidents
			SET postmortem = $2, rca_hypothesis = $3, updated_at = NOW()
			WHERE id = $1
		`, incidentID, req.Postmortem, req.RCAHypothesis)
		if err != nil {
			api.RespondError(w, r, http.StatusInternalServerError, "DB_ERROR", "Failed to save postmortem")
			return
		}

		_ = WriteTimelinePool(ctx, pool, incidentID, &actor.ID, "SYSTEM", "Post-mortem / RCA notes updated by "+actor.Email)

		api.RespondJSON(w, http.StatusOK, map[string]string{"status": "postmortem_saved"})
	}
}
