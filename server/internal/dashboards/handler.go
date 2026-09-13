package dashboards

import (
	"encoding/json"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/sentrix/server/internal/api"
	"github.com/sentrix/server/internal/auth"
)

type DashboardWidget struct {
	ID      string         `json:"id"`
	Type    string         `json:"type"` // METRIC_LINE, METRIC_GAUGE, LOG_STREAM, ALERT_LIST, PROCESS_LIST
	Title   string         `json:"title"`
	Metric  string         `json:"metric,omitempty"`
	ColSpan int            `json:"col_span"` // 1, 2, 3
	Config  map[string]any `json:"config,omitempty"`
}

type Dashboard struct {
	ID          string            `json:"id"`
	Title       string            `json:"title"`
	Description string            `json:"description"`
	IsDefault   bool              `json:"is_default"`
	Widgets     []DashboardWidget `json:"widgets"`
	CreatedAt   time.Time         `json:"created_at"`
	UpdatedAt   time.Time         `json:"updated_at"`
}

var (
	dashMu     sync.RWMutex
	dashboards []Dashboard
)

func init() {
	now := time.Now().UTC()

	d1 := Dashboard{
		ID:          "dash-primary",
		Title:       "Production Mission Control",
		Description: "Unified cross-stack telemetry view for core API gateways, microservices, and databases",
		IsDefault:   true,
		CreatedAt:   now.Add(-720 * time.Hour),
		UpdatedAt:   now,
		Widgets: []DashboardWidget{
			{
				ID:      "w-01",
				Type:    "METRIC_LINE",
				Title:   "Fleet CPU Saturation",
				Metric:  "system.cpu.utilization",
				ColSpan: 2,
			},
			{
				ID:      "w-02",
				Type:    "METRIC_GAUGE",
				Title:   "Database Pool Allocation",
				Metric:  "system.memory.utilization",
				ColSpan: 1,
			},
			{
				ID:      "w-03",
				Type:    "LOG_STREAM",
				Title:   "Realtime Error & Warning Log Stream",
				ColSpan: 2,
			},
			{
				ID:      "w-04",
				Type:    "ALERT_LIST",
				Title:   "Active Incidents & Triages",
				ColSpan: 1,
			},
		},
	}

	d2 := Dashboard{
		ID:          "dash-database",
		Title:       "TimescaleDB & Storage Performance",
		Description: "Hypertable chunk ingestion rates, buffer cache pressure, and disk IOPS latency",
		IsDefault:   false,
		CreatedAt:   now.Add(-480 * time.Hour),
		UpdatedAt:   now,
		Widgets: []DashboardWidget{
			{
				ID:      "w-11",
				Type:    "METRIC_LINE",
				Title:   "Timescale Chunk Write IOPS",
				Metric:  "system.disk.utilization",
				ColSpan: 2,
			},
			{
				ID:      "w-12",
				Type:    "METRIC_GAUGE",
				Title:   "Storage Utilization",
				Metric:  "system.disk.utilization",
				ColSpan: 1,
			},
		},
	}

	dashboards = []Dashboard{d1, d2}
}

// GET /api/v1/dashboards
func HandleListDashboards(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		dashMu.RLock()
		defer dashMu.RUnlock()
		api.RespondJSON(w, http.StatusOK, dashboards)
	}
}

// GET /api/v1/dashboards/{id}
func HandleGetDashboard(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")

		dashMu.RLock()
		defer dashMu.RUnlock()

		for _, d := range dashboards {
			if d.ID == id {
				api.RespondJSON(w, http.StatusOK, d)
				return
			}
		}

		api.RespondError(w, r, http.StatusNotFound, "NOT_FOUND", "Dashboard not found")
	}
}

// POST /api/v1/dashboards
func HandleCreateDashboard(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		actor := auth.GetUser(r)
		if actor == nil {
			api.RespondError(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication required")
			return
		}

		var req Dashboard
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			api.RespondError(w, r, http.StatusBadRequest, "INVALID_PAYLOAD", "Invalid dashboard payload")
			return
		}

		req.Title = strings.TrimSpace(req.Title)
		if req.Title == "" {
			api.RespondError(w, r, http.StatusBadRequest, "REQUIRED_FIELD", "Dashboard title is required")
			return
		}

		now := time.Now().UTC()
		req.ID = "dash-" + uuid.New().String()[:8]
		req.CreatedAt = now
		req.UpdatedAt = now
		if len(req.Widgets) == 0 {
			req.Widgets = []DashboardWidget{
				{
					ID:      "w-custom-01",
					Type:    "METRIC_LINE",
					Title:   "Fleet CPU Saturation",
					Metric:  "system.cpu.utilization",
					ColSpan: 2,
				},
			}
		}

		dashMu.Lock()
		dashboards = append([]Dashboard{req}, dashboards...)
		dashMu.Unlock()

		api.RespondJSON(w, http.StatusCreated, req)
	}
}
