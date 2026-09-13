package slo

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/sentrix/server/internal/api"
	"github.com/sentrix/server/internal/auth"
)

type SLOEntity struct {
	ID             string    `json:"id"`
	Name           string    `json:"name"`
	Service        string    `json:"service"`
	Target         float64   `json:"target_percent"`       // e.g. 99.95
	Current        float64   `json:"current_percent"`      // e.g. 99.98
	TimeWindow     string    `json:"time_window"`          // 30d, 7d
	ErrorBudgetMin float64   `json:"error_budget_minutes"` // allowed downtime minutes
	ConsumedMin    float64   `json:"consumed_minutes"`     // actual consumed downtime
	BurnRate       float64   `json:"burn_rate"`            // 1.0x is nominal budget burn
	Status         string    `json:"status"`               // HEALTHY, AT_RISK, BREACHED
	SLIType        string    `json:"sli_type"`             // AVAILABILITY, LATENCY, ERROR_RATE
	CreatedAt      time.Time `json:"created_at"`
}

var defaultSLOs = []SLOEntity{
	{
		ID:             "slo-001",
		Name:           "Checkout Ingestion API 99.95% Availability",
		Service:        "payments-service",
		Target:         99.95,
		Current:        99.97,
		TimeWindow:     "30d",
		ErrorBudgetMin: 21.6,
		ConsumedMin:    7.2,
		BurnRate:       1.15,
		Status:         "HEALTHY",
		SLIType:        "AVAILABILITY",
		CreatedAt:      time.Now().Add(-720 * time.Hour),
	},
	{
		ID:             "slo-002",
		Name:           "OIDC Authentication Token P95 Latency < 100ms",
		Service:        "auth-gateway",
		Target:         99.90,
		Current:        99.94,
		TimeWindow:     "30d",
		ErrorBudgetMin: 43.2,
		ConsumedMin:    12.4,
		BurnRate:       0.85,
		Status:         "HEALTHY",
		SLIType:        "LATENCY",
		CreatedAt:      time.Now().Add(-720 * time.Hour),
	},
	{
		ID:             "slo-003",
		Name:           "Telemetry Batch Ingestion Pipeline Availability",
		Service:        "telemetry-engine",
		Target:         99.99,
		Current:        99.92,
		TimeWindow:     "30d",
		ErrorBudgetMin: 4.32,
		ConsumedMin:    3.80,
		BurnRate:       2.45,
		Status:         "AT_RISK",
		SLIType:        "AVAILABILITY",
		CreatedAt:      time.Now().Add(-720 * time.Hour),
	},
}

// GET /api/v1/slos
func HandleListSLOs(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		api.RespondJSON(w, http.StatusOK, defaultSLOs)
	}
}

// POST /api/v1/slos
func HandleCreateSLO(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		actor := auth.GetUser(r)
		if actor == nil {
			api.RespondError(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication required")
			return
		}

		var req SLOEntity
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			api.RespondError(w, r, http.StatusBadRequest, "INVALID_PAYLOAD", "Invalid SLO payload")
			return
		}

		req.Name = strings.TrimSpace(req.Name)
		if req.Name == "" {
			api.RespondError(w, r, http.StatusBadRequest, "REQUIRED_FIELD", "SLO name is required")
			return
		}

		req.ID = "slo-" + uuid.New().String()[:8]
		req.CreatedAt = time.Now().UTC()
		if req.Target <= 0 {
			req.Target = 99.90
		}
		if req.Current <= 0 {
			req.Current = 99.95
		}
		if req.TimeWindow == "" {
			req.TimeWindow = "30d"
		}
		if req.Status == "" {
			req.Status = "HEALTHY"
		}
		if req.BurnRate <= 0 {
			req.BurnRate = 1.0
		}

		defaultSLOs = append([]SLOEntity{req}, defaultSLOs...)
		api.RespondJSON(w, http.StatusCreated, req)
	}
}
