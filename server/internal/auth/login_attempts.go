package auth

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrAccountLocked = errors.New("account temporarily locked")

func CheckLoginLocked(ctx context.Context, pool *pgxpool.Pool, email string) error {
	var failedCount int
	var lockedUntil *time.Time

	err := pool.QueryRow(ctx, `
		SELECT failed_count, locked_until
		FROM login_attempts
		WHERE email_lower = lower($1)
	`, email).Scan(&failedCount, &lockedUntil)

	if err == pgx.ErrNoRows {
		return nil
	}

	if err != nil {
		return err
	}

	if lockedUntil != nil && time.Now().Before(*lockedUntil) {
		return ErrAccountLocked
	}

	return nil
}

func RecordLoginFailure(ctx context.Context, pool *pgxpool.Pool, email string) error {
	_, err := pool.Exec(ctx, `
		INSERT INTO login_attempts (
			email_lower,
			failed_count,
			last_failed_at,
			locked_until
		) VALUES (
			lower($1), 1, NOW(), NULL
		)
		ON CONFLICT (email_lower)
		DO UPDATE SET
			failed_count = login_attempts.failed_count + 1,
			last_failed_at = NOW(),
			locked_until = CASE
				WHEN login_attempts.failed_count + 1 >= 9 THEN NOW() + INTERVAL '24 hours'
				WHEN login_attempts.failed_count + 1 >= 7 THEN NOW() + INTERVAL '1 hour'
				WHEN login_attempts.failed_count + 1 >= 5 THEN NOW() + INTERVAL '15 minutes'
				ELSE NULL
			END
	`, email)

	return err
}

func ResetLoginFailures(ctx context.Context, pool *pgxpool.Pool, email string) error {
	_, err := pool.Exec(ctx, `
		DELETE FROM login_attempts
		WHERE email_lower = lower($1)
	`, email)

	return err
}
