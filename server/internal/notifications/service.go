package notifications

import (
	"context"
	"encoding/json"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type AlertEventParams struct {
	EventType    string
	RuleID       string
	ServerID     string
	Severity     string
	Title        string
	Message      string
	CurrentValue float64
	Threshold    float64
}

func EnqueueAlertNotification(
	ctx context.Context,
	pool *pgxpool.Pool,
	params AlertEventParams,
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
		"event_type":    params.EventType,
		"rule_id":       params.RuleID,
		"server_id":     params.ServerID,
		"server_name":   serverName,
		"severity":      params.Severity,
		"title":         params.Title,
		"message":       params.Message,
		"current_value": params.CurrentValue,
		"threshold":     params.Threshold,
		"timestamp":     time.Now().UTC().Format(time.RFC3339),
	}

	payloadJSON, err := json.Marshal(payload)
	if err != nil {
		slog.Error("failed to marshal notification payload", "error", err)
		return
	}

	rows, err := pool.Query(ctx, `
		SELECT id
		FROM notification_channels
		WHERE enabled = true
	`)

	if err != nil {
		slog.Error("failed to load notification channels", "error", err)
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
				$1, $2, $3, $4, $5, $6
			)
		`,
			channelID,
			params.EventType,
			params.RuleID,
			params.ServerID,
			params.Severity,
			payloadJSON,
		)

		if err != nil {
			slog.Error("failed to enqueue notification job", "error", err)
			continue
		}

		count++
	}

	if count > 0 {
		slog.Info("notification jobs enqueued",
			"event_type", params.EventType,
			"server_id", params.ServerID,
			"channels", count,
		)
	}
}
