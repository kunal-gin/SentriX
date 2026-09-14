package deployments

import (
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Deployment struct {
	ID                   string     `json:"id"`
	ServiceID            string     `json:"service_id"`
	ServiceName          string     `json:"service_name"`
	Version              string     `json:"version"`
	CommitSHA            string     `json:"commit_sha"`
	CommitMessage        string     `json:"commit_message"`
	Author               string     `json:"author"`
	Environment          string     `json:"environment"`
	Status               string     `json:"status"` // SUCCESS, FAILED, ROLLING_BACK, IN_PROGRESS
	StartedAt            time.Time  `json:"started_at"`
	FinishedAt           *time.Time `json:"finished_at"`
	DurationSec          int        `json:"duration_sec"`
	CorrelatedIncidentID *string    `json:"correlated_incident_id,omitempty"`
}

type ChangeEvent struct {
	ID             string    `json:"id"`
	Category       string    `json:"category"` // DEPLOYMENT, CONFIG_CHANGE, SCHEMA_MIGRATION, AGENT_UPGRADE, RESTART
	TargetResource string    `json:"target_resource"`
	Description    string    `json:"description"`
	Actor          string    `json:"actor"`
	Environment    string    `json:"environment"`
	Timestamp      time.Time `json:"timestamp"`
}

var (
	depMu       sync.RWMutex
	incID       = "inc-1042"
	deployments = []*Deployment{
		{
			ID:                   "dep-v2-8-0",
			ServiceID:            "srv-payments",
			ServiceName:          "payments-service",
			Version:              "v2.8.0",
			CommitSHA:            "8a7d1e4",
			CommitMessage:        "feat: introduce batch account reconciliation lock query",
			Author:               "dev-payments@sentrix.local",
			Environment:          "Production",
			Status:               "SUCCESS",
			StartedAt:            time.Now().Add(-35 * time.Minute),
			FinishedAt:           func() *time.Time { t := time.Now().Add(-31 * time.Minute); return &t }(),
			DurationSec:          240,
			CorrelatedIncidentID: &incID,
		},
		{
			ID:            "dep-v1-2-4",
			ServiceID:     "srv-api-gateway",
			ServiceName:   "sentrix-api-gateway",
			Version:       "v1.2.4",
			CommitSHA:     "f4e920c",
			CommitMessage: "perf: optimize CORS header buffering and keepalive timeout",
			Author:        "sre-lead@acme.corp",
			Environment:   "Production",
			Status:        "SUCCESS",
			StartedAt:     time.Now().Add(-6 * time.Hour),
			FinishedAt:    func() *time.Time { t := time.Now().Add(-6*time.Hour + 90*time.Second); return &t }(),
			DurationSec:   90,
		},
		{
			ID:            "dep-v1-1-0",
			ServiceID:     "srv-auth",
			ServiceName:   "auth-service",
			Version:       "v1.1.0",
			CommitSHA:     "c21098b",
			CommitMessage: "sec: add SCIM 2.0 provisioning token encryption",
			Author:        "secops@acme.corp",
			Environment:   "Production",
			Status:        "SUCCESS",
			StartedAt:     time.Now().Add(-24 * time.Hour),
			FinishedAt:    func() *time.Time { t := time.Now().Add(-24*time.Hour + 110*time.Second); return &t }(),
			DurationSec:   110,
		},
	}

	changeEvents = []*ChangeEvent{
		{
			ID:             "chg-901",
			Category:       "DEPLOYMENT",
			TargetResource: "Deployment/payments-service",
			Description:    "Promoted payments-service:v2.8.0 across 4 replicas in Production",
			Actor:          "github-actions[bot]",
			Environment:    "Production",
			Timestamp:      time.Now().Add(-31 * time.Minute),
		},
		{
			ID:             "chg-902",
			Category:       "SCHEMA_MIGRATION",
			TargetResource: "srv-prod-db-primary (PostgreSQL)",
			Description:    "Executed migration 00012_reconcile_locks.sql without index",
			Actor:          "migration-runner",
			Environment:    "Production",
			Timestamp:      time.Now().Add(-33 * time.Minute),
		},
		{
			ID:             "chg-903",
			Category:       "CONFIG_CHANGE",
			TargetResource: "pgbouncer-primary",
			Description:    "Adjusted default_pool_size from 40 to 60",
			Actor:          "admin@sentrix.local",
			Environment:    "Production",
			Timestamp:      time.Now().Add(-2 * time.Hour),
		},
		{
			ID:             "chg-904",
			Category:       "AGENT_UPGRADE",
			TargetResource: "agt-us-east-prod-01",
			Description:    "Upgraded SentriX C collector daemon to v2.1.0 with disk ring buffer",
			Actor:          "admin@sentrix.local",
			Environment:    "Production",
			Timestamp:      time.Now().Add(-5 * time.Hour),
		},
	}
)

// GET /api/v1/deployments
func HandleListDeployments(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		depMu.RLock()
		defer depMu.RUnlock()

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(deployments)
	}
}

// POST /api/v1/deployments
func HandleCreateDeployment(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			ServiceID     string `json:"service_id"`
			ServiceName   string `json:"service_name"`
			Version       string `json:"version"`
			CommitSHA     string `json:"commit_sha"`
			CommitMessage string `json:"commit_message"`
			Author        string `json:"author"`
			Environment   string `json:"environment"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid JSON", http.StatusBadRequest)
			return
		}

		now := time.Now().UTC()
		depMu.Lock()
		newDep := &Deployment{
			ID:            "dep-" + uuid.New().String()[:8],
			ServiceID:     req.ServiceID,
			ServiceName:   req.ServiceName,
			Version:       req.Version,
			CommitSHA:     req.CommitSHA,
			CommitMessage: req.CommitMessage,
			Author:        req.Author,
			Environment:   req.Environment,
			Status:        "SUCCESS",
			StartedAt:     now,
			FinishedAt:    &now,
			DurationSec:   45,
		}
		deployments = append([]*Deployment{newDep}, deployments...)

		changeEvents = append([]*ChangeEvent{
			{
				ID:             "chg-" + uuid.New().String()[:6],
				Category:       "DEPLOYMENT",
				TargetResource: req.ServiceName,
				Description:    "Deployed version " + req.Version + " (" + req.CommitSHA + ")",
				Actor:          req.Author,
				Environment:    req.Environment,
				Timestamp:      now,
			},
		}, changeEvents...)
		depMu.Unlock()

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(newDep)
	}
}

// GET /api/v1/changes
func HandleListChanges(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		depMu.RLock()
		defer depMu.RUnlock()

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(changeEvents)
	}
}
