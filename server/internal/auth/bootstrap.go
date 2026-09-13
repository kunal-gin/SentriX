package auth

import (
	"context"
	"log/slog"
	"os"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

func BootstrapAdmin(ctx context.Context, pool *pgxpool.Pool) error {
	email := os.Getenv("SENTRIX_ADMIN_EMAIL")
	password := os.Getenv("SENTRIX_ADMIN_PASSWORD")

	if email == "" || password == "" {
		slog.Info("SENTRIX_ADMIN_EMAIL or SENTRIX_ADMIN_PASSWORD not set; skipping admin bootstrap")
		return nil
	}

	var userCount int

	err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM users`).Scan(&userCount)
	if err != nil {
		return err
	}

	if userCount > 0 {
		return nil
	}

	passwordHash, err := HashPassword(password)
	if err != nil {
		return err
	}

	id := uuid.New()

	_, err = pool.Exec(ctx, `
		INSERT INTO users (
			id,
			email,
			password_hash,
			role,
			status
		) VALUES (
			$1, lower($2), $3, 'ADMIN', 'ACTIVE'
		)
	`, id, email, passwordHash)

	if err != nil {
		return err
	}

	slog.Info("bootstrap admin user created", "email", email)

	return nil
}
