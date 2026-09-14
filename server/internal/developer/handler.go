package developer

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type APIKey struct {
	ID         string     `json:"id"`
	Name       string     `json:"name"`
	KeyPrefix  string     `json:"key_prefix"`
	Scopes     []string   `json:"scopes"` // read, write, ingest, automation, admin
	Status     string     `json:"status"` // ACTIVE, REVOKED
	LastUsedAt *time.Time `json:"last_used_at"`
	CreatedAt  time.Time  `json:"created_at"`
}

var (
	keysMu sync.RWMutex
	keys   = []*APIKey{
		{
			ID:         "key-ci-deploy",
			Name:       "GitHub Actions CI/CD Ingest Key",
			KeyPrefix:  "sk_live_ci_4f89...",
			Scopes:     []string{"ingest", "write"},
			Status:     "ACTIVE",
			LastUsedAt: func() *time.Time { t := time.Now().Add(-31 * time.Minute); return &t }(),
			CreatedAt:  time.Now().Add(-90 * 24 * time.Hour),
		},
		{
			ID:         "key-otel-collector",
			Name:       "OpenTelemetry Daemon Telemetry Collector",
			KeyPrefix:  "sk_live_otel_712a...",
			Scopes:     []string{"ingest"},
			Status:     "ACTIVE",
			LastUsedAt: func() *time.Time { t := time.Now().Add(-4 * time.Second); return &t }(),
			CreatedAt:  time.Now().Add(-60 * 24 * time.Hour),
		},
		{
			ID:         "key-automation-bot",
			Name:       "Runbook Auto-Remediation Worker Token",
			KeyPrefix:  "sk_live_auto_99bf...",
			Scopes:     []string{"read", "automation"},
			Status:     "ACTIVE",
			LastUsedAt: func() *time.Time { t := time.Now().Add(-3 * time.Hour); return &t }(),
			CreatedAt:  time.Now().Add(-30 * 24 * time.Hour),
		},
	}
)

func generateRandomKey(prefix string) (string, string) {
	bytes := make([]byte, 24)
	rand.Read(bytes)
	raw := prefix + "_" + base64.RawURLEncoding.EncodeToString(bytes)
	sum := sha256.Sum256([]byte(raw))
	hash := base64.StdEncoding.EncodeToString(sum[:])
	return raw, hash
}

// GET /api/v1/api-keys
func HandleListAPIKeys(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		keysMu.RLock()
		defer keysMu.RUnlock()

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(keys)
	}
}

// POST /api/v1/api-keys
func HandleCreateAPIKey(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Name   string   `json:"name"`
			Scopes []string `json:"scopes"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid JSON", http.StatusBadRequest)
			return
		}

		if len(req.Scopes) == 0 {
			req.Scopes = []string{"read"}
		}

		rawKey, _ := generateRandomKey("sk_live")
		prefix := rawKey[:14] + "..."

		newKey := &APIKey{
			ID:        "key-" + uuid.New().String()[:8],
			Name:      req.Name,
			KeyPrefix: prefix,
			Scopes:    req.Scopes,
			Status:    "ACTIVE",
			CreatedAt: time.Now().UTC(),
		}

		keysMu.Lock()
		keys = append([]*APIKey{newKey}, keys...)
		keysMu.Unlock()

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]any{
			"key_item": newKey,
			"raw_key":  rawKey,
		})
	}
}

// DELETE /api/v1/api-keys/{id}
func HandleRevokeAPIKey(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")

		keysMu.Lock()
		defer keysMu.Unlock()

		for _, k := range keys {
			if k.ID == id {
				k.Status = "REVOKED"
				break
			}
		}

		w.WriteHeader(http.StatusNoContent)
	}
}

// GET /api/v1/openapi.json
func HandleGetOpenAPISpec(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		spec := map[string]any{
			"openapi": "3.0.3",
			"info": map[string]any{
				"title":       "SentriX Enterprise Observability API",
				"version":     "1.1.0",
				"description": "High-throughput, programmatic REST and OTLP ingestion API for SentriX Enterprise Observability Platform.",
			},
			"paths": map[string]any{
				"/api/v1/metrics": map[string]any{
					"get": map[string]any{"summary": "Query multi-node cross-comparison telemetry"},
				},
				"/api/v1/telemetry/batch": map[string]any{
					"post": map[string]any{"summary": "Batch ingest metric samples from agents or OTEL collectors"},
				},
				"/api/v1/incidents": map[string]any{
					"get":  map[string]any{"summary": "List operational incidents"},
					"post": map[string]any{"summary": "Trigger automated incident"},
				},
				"/api/v1/incidents/{id}/rca": map[string]any{
					"get": map[string]any{"summary": "Evidence-backed Root Cause Analysis"},
				},
				"/api/v1/deployments": map[string]any{
					"get":  map[string]any{"summary": "List CI/CD deployments and change correlations"},
					"post": map[string]any{"summary": "Register deployment event"},
				},
				"/api/v1/runbooks/{id}/execute": map[string]any{
					"post": map[string]any{"summary": "Execute safe parameterized operational runbook"},
				},
			},
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(spec)
	}
}
