package checks

import (
	"context"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/sentrix/server/internal/notifications"
)

type checkSettings struct {
	ID               string
	ServerID         string
	Name             string
	Severity         string
	FailureThreshold int
	SuccessThreshold int
}

func ProcessResult(
	ctx context.Context,
	pool *pgxpool.Pool,
	checkID string,
	serverID string,
	status string,
	latencyMs int,
	message string,
) error {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var settings checkSettings

	err = tx.QueryRow(ctx, `
		SELECT
			id,
			server_id,
			name,
			severity,
			failure_threshold,
			success_threshold
		FROM checks
		WHERE id = $1
		  AND enabled = true
	`, checkID).Scan(
		&settings.ID,
		&settings.ServerID,
		&settings.Name,
		&settings.Severity,
		&settings.FailureThreshold,
		&settings.SuccessThreshold,
	)

	if err != nil {
		return err
	}

	if settings.FailureThreshold <= 0 {
		settings.FailureThreshold = 1
	}

	if settings.SuccessThreshold <= 0 {
		settings.SuccessThreshold = 1
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO check_results (
			time,
			check_id,
			server_id,
			status,
			latency_ms,
			message
		) VALUES (
			NOW(), $1, $2, $3, $4, $5
		)
	`, checkID, serverID, status, latencyMs, message)

	if err != nil {
		return err
	}

	var state string
	var consecutiveFailures int
	var consecutiveSuccesses int
	var incidentID *string

	err = tx.QueryRow(ctx, `
		SELECT
			state,
			consecutive_failures,
			consecutive_successes,
			incident_id
		FROM check_states
		WHERE check_id = $1
		FOR UPDATE
	`, checkID).Scan(&state, &consecutiveFailures, &consecutiveSuccesses, &incidentID)

	if err == pgx.ErrNoRows {
		state = "OK"
		consecutiveFailures = 0
		consecutiveSuccesses = 0
		incidentID = nil
	} else if err != nil {
		return err
	}

	now := time.Now()
	notifyFiring := false
	notifyResolved := false

	if status == "FAIL" {
		consecutiveFailures++
		consecutiveSuccesses = 0

		if state != "FAILING" && consecutiveFailures >= settings.FailureThreshold {
			newIncidentID := createCheckIncident(ctx, tx, settings, serverID, message)

			state = "FAILING"
			incidentID = &newIncidentID
			notifyFiring = true
		} else if state != "FAILING" {
			state = "PENDING"
		}
	} else {
		consecutiveSuccesses++
		consecutiveFailures = 0

		if state == "FAILING" && consecutiveSuccesses >= settings.SuccessThreshold {
			resolveCheckIncident(ctx, tx, settings, serverID)

			state = "OK"
			incidentID = nil
			notifyResolved = true
		} else if state != "FAILING" {
			state = "OK"
		}
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO check_states (
			check_id,
			server_id,
			state,
			consecutive_failures,
			consecutive_successes,
			last_status,
			last_message,
			last_result_at,
			incident_id,
			updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, NOW()
		)
		ON CONFLICT (check_id)
		DO UPDATE SET
			state = EXCLUDED.state,
			consecutive_failures = EXCLUDED.consecutive_failures,
			consecutive_successes = EXCLUDED.consecutive_successes,
			last_status = EXCLUDED.last_status,
			last_message = EXCLUDED.last_message,
			last_result_at = EXCLUDED.last_result_at,
			incident_id = EXCLUDED.incident_id,
			updated_at = NOW()
	`,
		checkID,
		serverID,
		state,
		consecutiveFailures,
		consecutiveSuccesses,
		status,
		message,
		now,
		incidentID,
	)

	if err != nil {
		return err
	}

	if err := tx.Commit(ctx); err != nil {
		return err
	}

	if notifyFiring {
		notifications.EnqueueCheckNotification(ctx, pool, notifications.CheckEventParams{
			EventType: "check.firing",
			CheckID:   settings.ID,
			ServerID:  serverID,
			Severity:  settings.Severity,
			Title:     "Check failed: " + settings.Name,
			Message:   message,
			Status:    "FAIL",
			LatencyMs: latencyMs,
		})
	}

	if notifyResolved {
		notifications.EnqueueCheckNotification(ctx, pool, notifications.CheckEventParams{
			EventType: "check.resolved",
			CheckID:   settings.ID,
			ServerID:  serverID,
			Severity:  settings.Severity,
			Title:     "Check recovered: " + settings.Name,
			Message:   message,
			Status:    "OK",
			LatencyMs: latencyMs,
		})
	}

	return nil
}

func createCheckIncident(
	ctx context.Context,
	tx pgx.Tx,
	settings checkSettings,
	serverID string,
	message string,
) string {
	incidentID := uuid.New()

	title := "Check failed: " + settings.Name
	summary := message

	err := tx.QueryRow(ctx, `
		INSERT INTO incidents (
			id,
			server_id,
			title,
			severity,
			status,
			started_at,
			root_check_id,
			summary
		) VALUES (
			$1, $2, $3, $4, 'OPEN', NOW(), $5, $6
		)
		ON CONFLICT DO NOTHING
		RETURNING id
	`,
		incidentID,
		serverID,
		title,
		settings.Severity,
		settings.ID,
		summary,
	).Scan(&incidentID)

	if err == pgx.ErrNoRows {
		var existingID uuid.UUID

		err = tx.QueryRow(ctx, `
			SELECT id
			FROM incidents
			WHERE server_id = $1
			  AND root_check_id = $2
			  AND status IN ('OPEN', 'ACKNOWLEDGED', 'INVESTIGATING')
			ORDER BY started_at DESC
			LIMIT 1
		`, serverID, settings.ID).Scan(&existingID)

		if err != nil {
			slog.Error("failed to locate existing check incident", "error", err)
			return ""
		}

		return existingID.String()
	}

	if err != nil {
		slog.Error("failed to create check incident", "error", err)
		return ""
	}

	slog.Info("check incident created",
		"check", settings.Name,
		"server_id", serverID,
	)

	return incidentID.String()
}

func resolveCheckIncident(
	ctx context.Context,
	tx pgx.Tx,
	settings checkSettings,
	serverID string,
) {
	_, err := tx.Exec(ctx, `
		UPDATE incidents
		SET
			status = 'RESOLVED',
			resolved_at = NOW()
		WHERE server_id = $1
		  AND root_check_id = $2
		  AND status IN ('OPEN', 'ACKNOWLEDGED', 'INVESTIGATING')
	`, serverID, settings.ID)

	if err != nil {
		slog.Error("failed to resolve check incident", "error", err)
		return
	}

	slog.Info("check incident resolved",
		"check", settings.Name,
		"server_id", serverID,
	)
}
