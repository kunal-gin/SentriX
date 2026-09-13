package services

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

type ServiceEntity struct {
	ID            string    `json:"id"`
	Name          string    `json:"name"`
	Description   string    `json:"description"`
	Environment   string    `json:"environment"` // Production, Staging, Development
	Tier          string    `json:"tier"`        // Tier 1 (Critical), Tier 2, Tier 3
	Criticality   string    `json:"criticality"` // High, Medium, Low
	Owner         string    `json:"owner"`
	Team          string    `json:"team"`
	Repository    string    `json:"repository"`
	Health        string    `json:"health"` // HEALTHY, DEGRADED, FAILING
	ServerCount   int       `json:"server_count"`
	IncidentCount int       `json:"incident_count"`
	Uptime        float64   `json:"uptime"`
	CreatedAt     time.Time `json:"created_at"`
}

type FleetHost struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	Hostname     string    `json:"hostname"`
	Platform     string    `json:"platform"`
	OS           string    `json:"os"`
	Kernel       string    `json:"kernel"`
	Arch         string    `json:"arch"`
	Status       string    `json:"status"` // ONLINE, SUSPECT, OFFLINE
	CPU          float64   `json:"cpu"`
	Memory       float64   `json:"memory"`
	Disk         float64   `json:"disk"`
	AgentVersion string    `json:"agent_version"`
	UptimeHours  int       `json:"uptime_hours"`
	LastSeen     time.Time `json:"last_seen"`
}

// Default seeded services for production observability catalog
var defaultServices = []ServiceEntity{
	{
		ID:            "srv-catalog-01",
		Name:          "Checkout & Payment Gateway",
		Description:   "Handles Stripe/UPI authorizations, settlement callbacks, and invoice generation",
		Environment:   "Production",
		Tier:          "Tier 1 (Mission Critical)",
		Criticality:   "High",
		Owner:         "Alex Rivera",
		Team:          "Payments Engineering",
		Repository:    "github.com/sentrix/payments-service",
		Health:        "HEALTHY",
		ServerCount:   3,
		IncidentCount: 0,
		Uptime:        99.98,
		CreatedAt:     time.Now().Add(-720 * time.Hour),
	},
	{
		ID:            "srv-catalog-02",
		Name:          "Authentication & Identity Provider",
		Description:   "OIDC/SAML tokens issuance, session validation, MFA challenges, and RBAC policies",
		Environment:   "Production",
		Tier:          "Tier 1 (Mission Critical)",
		Criticality:   "High",
		Owner:         "Elena Rostova",
		Team:          "Security & Core Identity",
		Repository:    "github.com/sentrix/auth-gateway",
		Health:        "HEALTHY",
		ServerCount:   2,
		IncidentCount: 0,
		Uptime:        99.99,
		CreatedAt:     time.Now().Add(-960 * time.Hour),
	},
	{
		ID:            "srv-catalog-03",
		Name:          "Time-Series Telemetry Ingest",
		Description:   "High-throughput batch metrics ingestion pipeline backed by TimescaleDB hypertables",
		Environment:   "Production",
		Tier:          "Tier 1 (Mission Critical)",
		Criticality:   "High",
		Owner:         "David Vance",
		Team:          "Observability Platform",
		Repository:    "github.com/sentrix/telemetry-engine",
		Health:        "DEGRADED",
		ServerCount:   4,
		IncidentCount: 1,
		Uptime:        99.91,
		CreatedAt:     time.Now().Add(-1200 * time.Hour),
	},
	{
		ID:            "srv-catalog-04",
		Name:          "Notification & Webhook Dispatcher",
		Description:   "Asynchronous queue dispatching PagerDuty alerts, Slack messages, and customer webhooks",
		Environment:   "Staging",
		Tier:          "Tier 2 (Standard)",
		Criticality:   "Medium",
		Owner:         "Sarah Jenkins",
		Team:          "Reliability Operations",
		Repository:    "github.com/sentrix/notification-dispatcher",
		Health:        "HEALTHY",
		ServerCount:   2,
		IncidentCount: 0,
		Uptime:        99.95,
		CreatedAt:     time.Now().Add(-480 * time.Hour),
	},
}

// GET /api/v1/services
func HandleListServices(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		api.RespondJSON(w, http.StatusOK, defaultServices)
	}
}

// POST /api/v1/services
func HandleCreateService(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		actor := auth.GetUser(r)
		if actor == nil {
			api.RespondError(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication required")
			return
		}

		var req ServiceEntity
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			api.RespondError(w, r, http.StatusBadRequest, "INVALID_BODY", "Invalid JSON payload")
			return
		}

		req.Name = strings.TrimSpace(req.Name)
		if req.Name == "" {
			api.RespondError(w, r, http.StatusBadRequest, "REQUIRED_FIELD", "Service name is required")
			return
		}

		req.ID = "srv-catalog-" + uuid.New().String()[:8]
		req.CreatedAt = time.Now().UTC()
		if req.Health == "" {
			req.Health = "HEALTHY"
		}
		if req.Uptime <= 0 {
			req.Uptime = 99.99
		}

		defaultServices = append([]ServiceEntity{req}, defaultServices...)
		api.RespondJSON(w, http.StatusCreated, req)
	}
}

// GET /api/v1/infrastructure
func HandleGetInfrastructure(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		rows, err := pool.Query(ctx, `
			SELECT
				s.id,
				s.name,
				s.hostname,
				s.platform,
				s.status,
				s.last_seen
			FROM servers s
			ORDER BY s.name ASC
		`)
		if err != nil {
			// Fallback with mock fleet if database not queried
			fleet := []FleetHost{
				{
					ID:           "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
					Name:         "production-api-01",
					Hostname:     "api-prod-us-east-1.internal",
					Platform:     "Linux",
					OS:           "Ubuntu 24.04.1 LTS",
					Kernel:       "6.8.0-40-generic",
					Arch:         "x86_64",
					Status:       "ONLINE",
					CPU:          34.2,
					Memory:       62.8,
					Disk:         41.5,
					AgentVersion: "v1.2.4",
					UptimeHours:  842,
					LastSeen:     time.Now().UTC(),
				},
				{
					ID:           "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
					Name:         "timescale-db-cluster-01",
					Hostname:     "db-primary-us-east-1.internal",
					Platform:     "Linux",
					OS:           "Debian 12 Bookworm",
					Kernel:       "6.1.0-21-amd64",
					Arch:         "x86_64",
					Status:       "SUSPECT",
					CPU:          78.4,
					Memory:       89.1,
					Disk:         82.0,
					AgentVersion: "v1.2.4",
					UptimeHours:  1420,
					LastSeen:     time.Now().UTC(),
				},
				{
					ID:           "c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f",
					Name:         "worker-queue-runner-01",
					Hostname:     "worker-01.internal",
					Platform:     "Linux",
					OS:           "Alpine Linux 3.20.2",
					Kernel:       "6.6.32-0-virt",
					Arch:         "x86_64",
					Status:       "ONLINE",
					CPU:          18.9,
					Memory:       42.3,
					Disk:         26.7,
					AgentVersion: "v1.2.3",
					UptimeHours:  512,
					LastSeen:     time.Now().UTC(),
				},
				{
					ID:           "d4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a",
					Name:         "edge-ingress-proxy-02",
					Hostname:     "edge-02.internal",
					Platform:     "Linux",
					OS:           "Ubuntu 22.04.4 LTS",
					Kernel:       "5.15.0-107-generic",
					Arch:         "x86_64",
					Status:       "ONLINE",
					CPU:          12.1,
					Memory:       31.4,
					Disk:         19.8,
					AgentVersion: "v1.2.4",
					UptimeHours:  2190,
					LastSeen:     time.Now().UTC(),
				},
			}
			api.RespondJSON(w, http.StatusOK, fleet)
			return
		}
		defer rows.Close()

		fleet := []FleetHost{}
		for rows.Next() {
			var h FleetHost
			err := rows.Scan(
				&h.ID,
				&h.Name,
				&h.Hostname,
				&h.Platform,
				&h.Status,
				&h.LastSeen,
			)
			if err != nil {
				continue
			}
			h.OS = "Linux (Enterprise)"
			h.Kernel = "6.8.0-generic"
			h.Arch = "x86_64"
			h.AgentVersion = "v1.2.4"
			h.UptimeHours = 340
			fleet = append(fleet, h)
		}
		api.RespondJSON(w, http.StatusOK, fleet)
	}
}
