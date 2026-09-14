package organizations

import (
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Organization struct {
	ID            string    `json:"id"`
	Name          string    `json:"name"`
	Slug          string    `json:"slug"`
	Plan          string    `json:"plan"` // COMMUNITY, PRO, ENTERPRISE
	Environments  []string  `json:"environments"`
	ServerQuota   int       `json:"server_quota"`
	RetentionDays int       `json:"retention_days"`
	CreatedAt     time.Time `json:"created_at"`
}

type Team struct {
	ID           string    `json:"id"`
	OrgID        string    `json:"org_id"`
	Name         string    `json:"name"`
	Description  string    `json:"description"`
	MembersCount int       `json:"members_count"`
	LeadEmail    string    `json:"lead_email"`
	CreatedAt    time.Time `json:"created_at"`
}

type TenantQuota struct {
	OrgID             string `json:"org_id"`
	ServersActive     int    `json:"servers_active"`
	ServersLimit      int    `json:"servers_limit"`
	MetricsPerSec     int    `json:"metrics_per_sec"`
	MetricsLimit      int    `json:"metrics_limit"`
	LogsGBPerDay      float64 `json:"logs_gb_per_day"`
	LogsLimitGB       float64 `json:"logs_limit_gb"`
	RetentionDays     int    `json:"retention_days"`
	CustomDashboards  int    `json:"custom_dashboards"`
	DashboardsLimit   int    `json:"dashboards_limit"`
}

var (
	orgMu sync.RWMutex
	orgs  = []*Organization{
		{
			ID:            "org-acme-corp",
			Name:          "Acme Global Technologies",
			Slug:          "acme-corp",
			Plan:          "ENTERPRISE",
			Environments:  []string{"Production", "Staging", "Development", "DR-Failover"},
			ServerQuota:   100,
			RetentionDays: 90,
			CreatedAt:     time.Now().Add(-365 * 24 * time.Hour),
		},
		{
			ID:            "org-fintech-sec",
			Name:          "FinTech Secure Payments",
			Slug:          "fintech-sec",
			Plan:          "ENTERPRISE",
			Environments:  []string{"Production-US", "Production-EU", "Sandbox"},
			ServerQuota:   250,
			RetentionDays: 365,
			CreatedAt:     time.Now().Add(-180 * 24 * time.Hour),
		},
	}

	teams = []*Team{
		{
			ID:           "team-infra-core",
			OrgID:        "org-acme-corp",
			Name:         "Core Infrastructure & Cloud Ops",
			Description:  "Maintains Linux host fleet, Kubernetes clusters, and mTLS agent orchestration.",
			MembersCount: 8,
			LeadEmail:    "infra-lead@acme.corp",
			CreatedAt:    time.Now().Add(-300 * 24 * time.Hour),
		},
		{
			ID:           "team-sre-reliability",
			OrgID:        "org-acme-corp",
			Name:         "Site Reliability Engineering (SRE)",
			Description:  "Owns SLO error budgets, synthetic monitoring, and 24/7 on-call incident response.",
			MembersCount: 6,
			LeadEmail:    "sre-lead@acme.corp",
			CreatedAt:    time.Now().Add(-280 * 24 * time.Hour),
		},
		{
			ID:           "team-payments-eng",
			OrgID:        "org-acme-corp",
			Name:         "Payments & Billing Services",
			Description:  "Manages transaction processing gateways, PostgreSQL pools, and Kafka consumers.",
			MembersCount: 12,
			LeadEmail:    "payments-lead@acme.corp",
			CreatedAt:    time.Now().Add(-200 * 24 * time.Hour),
		},
		{
			ID:           "team-secops",
			OrgID:        "org-acme-corp",
			Name:         "Security Operations (SecOps)",
			Description:  "Perimeter shield audits, IAM roles, SAML/OIDC federations, and compliance.",
			MembersCount: 4,
			LeadEmail:    "secops-lead@acme.corp",
			CreatedAt:    time.Now().Add(-150 * 24 * time.Hour),
		},
	}
)

// GET /api/v1/organizations
func HandleListOrganizations(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		orgMu.RLock()
		defer orgMu.RUnlock()

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(orgs)
	}
}

// POST /api/v1/organizations
func HandleCreateOrganization(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Name string `json:"name"`
			Slug string `json:"slug"`
			Plan string `json:"plan"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "invalid payload", http.StatusBadRequest)
			return
		}

		if body.Plan == "" {
			body.Plan = "PRO"
		}

		orgMu.Lock()
		newOrg := &Organization{
			ID:            "org-" + uuid.New().String()[:8],
			Name:          body.Name,
			Slug:          body.Slug,
			Plan:          body.Plan,
			Environments:  []string{"Production", "Staging", "Development"},
			ServerQuota:   50,
			RetentionDays: 30,
			CreatedAt:     time.Now().UTC(),
		}
		orgs = append(orgs, newOrg)
		orgMu.Unlock()

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(newOrg)
	}
}

// GET /api/v1/organizations/{id}/teams
func HandleListTeams(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		orgMu.RLock()
		defer orgMu.RUnlock()

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(teams)
	}
}

// GET /api/v1/organizations/{id}/quota
func HandleGetTenantQuota(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")

		quota := TenantQuota{
			OrgID:            id,
			ServersActive:    4,
			ServersLimit:     100,
			MetricsPerSec:    2450,
			MetricsLimit:     50000,
			LogsGBPerDay:     14.2,
			LogsLimitGB:      250.0,
			RetentionDays:    90,
			CustomDashboards: 3,
			DashboardsLimit:  50,
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(quota)
	}
}
