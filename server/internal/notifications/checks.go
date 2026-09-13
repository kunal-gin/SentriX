package notifications

import (
	"context"
	"encoding/json"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type CheckEventParams struct {
	EventType string
	CheckID   string
	ServerID  string
	Severity  string
	Title     string
	Message   string
	Status    string
	LatencyMs int
}

func EnqueueCheckNotification(
	ctx context.Context,
	pool *pgxpool.Pool,
	params CheckEventParams,
) {
	var serverName string

	err := pool.QueryRow(ctx, `
		SELECT name
		FROM servers
		WHERE id = $1
	`, params.ServerID).Scan(&serverName)

	if err != nil {
		serverName = params.ServerID
	}

	payload := map[string]any{
		"event_type":  params.EventType,
		"source_type": "check",
		"check_id":    params.CheckID,
		"server_id":   params.ServerID,
		"server_name": serverName,
		"severity":    params.Severity,
		"title":       params.Title,
		"message":     params.Message,
		"status":      params.Status,
		"latency_ms":  params.LatencyMs,
		"timestamp":   time.Now().UTC().Format(time.RFC3339),
	}

	payloadJSON, err := json.Marshal(payload)
	if err != nil {
		slog.Error("failed to marshal check notification payload", "error", err)
		return
	}

	rows, err := pool.Query(ctx, `
		SELECT id
		FROM notification_channels
		WHERE enabled = true
	`)

	if err != nil {
		slog.Error("failed to load notification channels for check event", "error", err)
		return
	}
	defer rows.Close()

	count := 0

	for rows.Next() {
		var channelID string

		if err := rows.Scan(&channelID); err != nil {
			slog.Error("failed to scan notification channel", "error", err)
			continue
		}

		_, err := pool.Exec(ctx, `
			INSERT INTO notification_jobs (
				channel_id,
				event_type,
				alert_rule_id,
				server_id,
				severity,
				payload
			) VALUES (
				$1, $2, NULL, $3, $4, $5
			)
		`,
			channelID,
			params.EventType,
			params.ServerID,
			params.Severity,
			payloadJSON,
		)

		if err != nil {
			slog.Error("failed to enqueue check notification job", "error", err)
			continue
		}

		count++
	}

	if count > 0 {
		slog.Info("check notification jobs enqueued",
			"event_type", params.EventType,
			"check_id", params.CheckID,
			"server_id", params.ServerID,
			"channels", count,
		)
	}
}
