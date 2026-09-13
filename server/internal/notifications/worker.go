package notifications

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type jobRow struct {
	ID          string
	ChannelID   string
	Attempts    int
	MaxAttempts int
	Payload     []byte
}

func StartWorker(ctx context.Context, pool *pgxpool.Pool) {
	slog.Info("notification worker started")

	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			slog.Info("notification worker stopped")
			return
		case <-ticker.C:
			processDueJobs(ctx, pool)
		}
	}
}

func processDueJobs(ctx context.Context, pool *pgxpool.Pool) {
	tx, err := pool.Begin(ctx)
	if err != nil {
		slog.Error("failed to begin notification tx", "error", err)
		return
	}
	defer tx.Rollback(ctx)

	rows, err := tx.Query(ctx, `
		SELECT
			id,
			channel_id,
			attempts,
			max_attempts,
			payload
		FROM notification_jobs
		WHERE status IN ('PENDING', 'RETRYING')
		  AND attempts < max_attempts
		  AND next_attempt_at <= NOW()
		ORDER BY next_attempt_at ASC
		LIMIT 20
		FOR UPDATE SKIP LOCKED
	`)

	if err != nil {
		slog.Error("failed to query notification jobs", "error", err)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var job jobRow

		err := rows.Scan(
			&job.ID,
			&job.ChannelID,
			&job.Attempts,
			&job.MaxAttempts,
			&job.Payload,
		)

		if err != nil {
			slog.Error("failed to scan notification job", "error", err)
			continue
		}

		processJob(ctx, tx, job)
	}

	if err := tx.Commit(ctx); err != nil {
		slog.Error("failed to commit notification tx", "error", err)
	}
}

func processJob(ctx context.Context, tx pgx.Tx, job jobRow) {
	var channelType string
	var enabled bool
	var config []byte

	err := tx.QueryRow(ctx, `
		SELECT type, enabled, config
		FROM notification_channels
		WHERE id = $1
	`, job.ChannelID).Scan(&channelType, &enabled, &config)

	if err != nil {
		markJobFailed(ctx, tx, job.ID, "notification channel not found", 0)
		return
	}

	if !enabled {
		markJobFailed(ctx, tx, job.ID, "notification channel disabled", 0)
		return
	}

	if channelType != "WEBHOOK" {
		markJobFailed(ctx, tx, job.ID, "unsupported notification channel type", 0)
		return
	}

	var cfg struct {
		URL string `json:"url"`
	}

	if err := json.Unmarshal(config, &cfg); err != nil || cfg.URL == "" {
		markJobFailed(ctx, tx, job.ID, "invalid webhook configuration", 0)
		return
	}

	statusCode, err := sendWebhook(ctx, cfg.URL, job.Payload)

	if err == nil {
		_, updateErr := tx.Exec(ctx, `
			UPDATE notification_jobs
			SET
				status = 'SENT',
				attempts = attempts + 1,
				last_error = NULL,
				updated_at = NOW()
			WHERE id = $1
		`, job.ID)

		if updateErr != nil {
			slog.Error("failed to mark notification job sent", "error", updateErr)
		}

		insertDelivery(ctx, tx, job.ID, "SUCCESS", statusCode, "")
		return
	}

	job.Attempts++

	newStatus := "RETRYING"
	if job.Attempts >= job.MaxAttempts {
		newStatus = "FAILED"
	}

	delaySeconds := 30 * (1 << (job.Attempts - 1))
	nextAttempt := time.Now().Add(time.Duration(delaySeconds) * time.Second)

	_, updateErr := tx.Exec(ctx, `
		UPDATE notification_jobs
		SET
			status = $2,
			attempts = $3,
			last_error = $4,
			next_attempt_at = $5,
			updated_at = NOW()
		WHERE id = $1
	`, job.ID, newStatus, job.Attempts, err.Error(), nextAttempt)

	if updateErr != nil {
		slog.Error("failed to update failed notification job", "error", updateErr)
	}

	insertDelivery(ctx, tx, job.ID, "FAILED", statusCode, err.Error())
}

func sendWebhook(ctx context.Context, url string, payload []byte) (int, error) {
	reqCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(
		reqCtx,
		http.MethodPost,
		url,
		bytes.NewReader(payload),
	)

	if err != nil {
		return 0, err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "SentriX-Notifier")

	client := &http.Client{}

	resp, err := client.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()

	_, _ = io.Copy(io.Discard, resp.Body)

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return resp.StatusCode, fmt.Errorf("unexpected webhook status: %d", resp.StatusCode)
	}

	return resp.StatusCode, nil
}

func markJobFailed(ctx context.Context, tx pgx.Tx, jobID string, reason string, httpStatus int) {
	_, err := tx.Exec(ctx, `
		UPDATE notification_jobs
		SET
			status = 'FAILED',
			attempts = max_attempts,
			last_error = $2,
			updated_at = NOW()
		WHERE id = $1
	`, jobID, reason)

	if err != nil {
		slog.Error("failed to mark notification job failed", "error", err)
	}

	insertDelivery(ctx, tx, jobID, "FAILED", httpStatus, reason)
}

func insertDelivery(ctx context.Context, tx pgx.Tx, jobID string, status string, httpStatus int, errMsg string) {
	var httpStatusValue interface{}
	if httpStatus != 0 {
		httpStatusValue = httpStatus
	}

	_, err := tx.Exec(ctx, `
		INSERT INTO notification_deliveries (
			job_id,
			status,
			http_status,
			error
		) VALUES (
			$1, $2, $3, $4
		)
	`, jobID, status, httpStatusValue, errMsg)

	if err != nil {
		slog.Error("failed to insert notification delivery", "error", err)
	}
}
