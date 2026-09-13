package incidents

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func WriteTimelineTx(
	ctx context.Context,
	tx pgx.Tx,
	incidentID string,
	actorID *string,
	eventType string,
	message string,
) error {
	_, err := tx.Exec(ctx, `
		INSERT INTO incident_timeline_events (
			incident_id,
			actor_id,
			event_type,
			message
		) VALUES (
			$1, $2, $3, $4
		)
	`, incidentID, actorID, eventType, message)

	return err
}

func WriteTimelinePool(
	ctx context.Context,
	pool *pgxpool.Pool,
	incidentID string,
	actorID *string,
	eventType string,
	message string,
) error {
	_, err := pool.Exec(ctx, `
		INSERT INTO incident_timeline_events (
			incident_id,
			actor_id,
			event_type,
			message
		) VALUES (
			$1, $2, $3, $4
		)
	`, incidentID, actorID, eventType, message)

	return err
}
