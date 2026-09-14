package billing

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/sentrix/server/internal/api"
	"github.com/sentrix/server/internal/auth"
)

type PlanTier struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	PriceUSD    int      `json:"price_usd_monthly"`
	NodeLimit   int      `json:"node_limit"`
	MetricsSec  int      `json:"metrics_per_sec"`
	RetentionDays int    `json:"retention_days"`
	Features    []string `json:"features"`
	Current     bool     `json:"current"`
}

type UsageMetering struct {
	OrganizationID    string    `json:"organization_id"`
	PlanTier          string    `json:"plan_tier"`
	ActiveNodes       int       `json:"active_nodes"`
	NodeLimit         int       `json:"node_limit"`
	MetricsPerSec     int       `json:"metrics_per_sec"`
	MetricsLimit      int       `json:"metrics_limit"`
	LogStorageGB      float64   `json:"log_storage_gb"`
	LogStorageLimitGB float64   `json:"log_storage_limit_gb"`
	TraceSpansMonthly int64     `json:"trace_spans_monthly"`
	APIRequests24h    int       `json:"api_requests_24h"`
	BillingPeriodEnd  time.Time `json:"billing_period_end"`
}

var defaultPlans = []PlanTier{
	{
		ID:            "plan-community",
		Name:          "Community Open-Source",
		PriceUSD:      0,
		NodeLimit:     5,
		MetricsSec:    1000,
		RetentionDays: 7,
		Features:      []string{"Host Metrics", "Basic Alerts", "Community Discord Support"},
		Current:       false,
	},
	{
		ID:            "plan-pro",
		Name:          "Professional Cloud",
		PriceUSD:      199,
		NodeLimit:     50,
		MetricsSec:    25000,
		RetentionDays: 30,
		Features:      []string{"OTel Traces", "Central Logs", "Custom Dashboards", "Slack/PagerDuty Integrations", "Email Support"},
		Current:       false,
	},
	{
		ID:            "plan-enterprise",
		Name:          "Enterprise Sentinel",
		PriceUSD:      899,
		NodeLimit:     500,
		MetricsSec:    250000,
		RetentionDays: 365,
		Features:      []string{"Multi-Tenancy", "OIDC/SAML SSO", "Intelligence 2.0 RCA", "Runbook Automation", "Capacity & FinOps", "DR Automated Verification", "24/7 SLA Guarantee"},
		Current:       true,
	},
}

var currentUsage = UsageMetering{
	OrganizationID:    "org-acme-corp",
	PlanTier:          "Enterprise Sentinel",
	ActiveNodes:       8,
	NodeLimit:         500,
	MetricsPerSec:     12400,
	MetricsLimit:      250000,
	LogStorageGB:      14.2,
	LogStorageLimitGB: 500.0,
	TraceSpansMonthly: 8420000,
	APIRequests24h:    42500,
	BillingPeriodEnd:  time.Now().Add(18 * 24 * time.Hour),
}

// GET /api/v1/billing/plans
func HandleListPlans(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		api.RespondJSON(w, http.StatusOK, defaultPlans)
	}
}

// GET /api/v1/billing/usage
func HandleGetUsage(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		api.RespondJSON(w, http.StatusOK, currentUsage)
	}
}

// POST /api/v1/billing/subscribe
func HandleSubscribe(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		actor := auth.GetUser(r)
		if actor == nil {
			api.RespondError(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication required")
			return
		}

		var req struct {
			PlanID string `json:"plan_id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			api.RespondError(w, r, http.StatusBadRequest, "INVALID_PAYLOAD", "Invalid plan payload")
			return
		}

		for i := range defaultPlans {
			defaultPlans[i].Current = (defaultPlans[i].ID == req.PlanID)
			if defaultPlans[i].ID == req.PlanID {
				currentUsage.PlanTier = defaultPlans[i].Name
				currentUsage.NodeLimit = defaultPlans[i].NodeLimit
				currentUsage.MetricsLimit = defaultPlans[i].MetricsSec
			}
		}

		api.RespondJSON(w, http.StatusOK, map[string]interface{}{
			"message": "Subscription updated successfully",
			"usage":   currentUsage,
		})
	}
}
