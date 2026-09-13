package storage

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

func ApplyMigrations(ctx context.Context, pool *pgxpool.Pool, dir string) error {
	if dir == "" {
		slog.Info("SENTRIX_MIGRATIONS_DIR not set; skipping automatic migrations")
		return nil
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		return fmt.Errorf("failed to read migrations directory: %w", err)
	}

	files := []string{}

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		if strings.HasSuffix(entry.Name(), ".sql") {
			files = append(files, entry.Name())
		}
	}

	sort.Strings(files)

	_, err = pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			filename TEXT PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`)

	if err != nil {
		return fmt.Errorf("failed to create schema_migrations table: %w", err)
	}

	var migrationCount int

	err = pool.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM schema_migrations
	`).Scan(&migrationCount)

	if err != nil {
		return fmt.Errorf("failed to count migrations: %w", err)
	}

	// Baseline support for databases created before the migration runner existed.
	if migrationCount == 0 {
		var usersExists bool

		err = pool.QueryRow(ctx, `
			SELECT EXISTS (
				SELECT 1
				FROM information_schema.tables
				WHERE table_schema = 'public'
				  AND table_name = 'users'
			)
		`).Scan(&usersExists)

		if err != nil {
			return fmt.Errorf("failed to check for existing schema: %w", err)
		}

		if usersExists {
			slog.Info("existing database detected; baseline migrations 00001-00005")

			for _, file := range files {
				if strings.HasPrefix(file, "00001_") ||
					strings.HasPrefix(file, "00002_") ||
					strings.HasPrefix(file, "00003_") ||
					strings.HasPrefix(file, "00004_") ||
					strings.HasPrefix(file, "00005_") {

					_, err := pool.Exec(ctx, `
						INSERT INTO schema_migrations (filename)
						VALUES ($1)
						ON CONFLICT DO NOTHING
					`, file)

					if err != nil {
						return fmt.Errorf("failed to baseline migration %s: %w", file, err)
					}
				}
			}
		}
	}

	appliedRows, err := pool.Query(ctx, `
		SELECT filename
		FROM schema_migrations
	`)

	if err != nil {
		return fmt.Errorf("failed to list applied migrations: %w", err)
	}

	applied := map[string]bool{}

	for appliedRows.Next() {
		var filename string

		if err := appliedRows.Scan(&filename); err != nil {
			appliedRows.Close()
			return fmt.Errorf("failed to scan applied migration: %w", err)
		}

		applied[filename] = true
	}

	appliedRows.Close()

	for _, file := range files {
		if applied[file] {
			continue
		}

		fullPath := filepath.Join(dir, file)

		content, err := os.ReadFile(fullPath)
		if err != nil {
			return fmt.Errorf("failed to read migration %s: %w", file, err)
		}

		tx, err := pool.Begin(ctx)
		if err != nil {
			return fmt.Errorf("failed to begin transaction for migration %s: %w", file, err)
		}

		_, err = tx.Exec(ctx, string(content))
		if err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("migration %s failed: %w", file, err)
		}

		_, err = tx.Exec(ctx, `
			INSERT INTO schema_migrations (filename)
			VALUES ($1)
		`, file)

		if err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("failed to record migration %s: %w", file, err)
		}

		if err := tx.Commit(ctx); err != nil {
			return fmt.Errorf("failed to commit migration %s: %w", file, err)
		}

		slog.Info("applied migration", "file", file)
	}

	return nil
}
