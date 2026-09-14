package capacity

import (
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/sentrix/server/internal/api"
)

type ResourceForecast struct {
	ResourceName        string    `json:"resource_name"` // Disk, RAM, CPU, TimescaleDB Chunks
	CurrentUsagePct     float64   `json:"current_usage_pct"`
	GrowthRatePerDayPct float64   `json:"growth_rate_per_day_pct"`
	DaysToSaturation    int       `json:"days_to_saturation"` // Days until 90% or 100%
	ThresholdLimitPct   float64   `json:"threshold_limit_pct"`
	Recommendation      string    `json:"recommendation"`
	Severity            string    `json:"severity"` // HEALTHY, WARNING, CRITICAL
	ProjectedDate       time.Time `json:"projected_date"`
}

type FinOpsCostSummary struct {
	TotalMonthlySpend     float64            `json:"total_monthly_spend"`
	Currency              string             `json:"currency"`
	ChangeVsLastMonthPct  float64            `json:"change_vs_last_month_pct"`
	EfficiencyScore       int                `json:"efficiency_score"` // 0 - 100
	EstimatedMonthlyWaste float64            `json:"estimated_monthly_waste"`
	BreakdownByProvider   map[string]float64 `json:"breakdown_by_provider"` // AWS, GCP, Azure, BareMetal
	BreakdownByCategory   map[string]float64 `json:"breakdown_by_category"` // Compute, Storage, Egress, DB
	Recommendations       []string           `json:"recommendations"`
}

var defaultForecasts = []ResourceForecast{
	{
		ResourceName:        "Primary TimescaleDB Storage Pool (NVMe)",
		CurrentUsagePct:     76.4,
		GrowthRatePerDayPct: 0.85,
		DaysToSaturation:    16,
		ThresholdLimitPct:   90.0,
		Recommendation:      "Attach additional 500GB EBS volume or reduce raw metric retention from 90d to 60d",
		Severity:            "WARNING",
		ProjectedDate:       time.Now().Add(16 * 24 * time.Hour),
	},
	{
		ResourceName:        "Ingestion Cluster RAM (Memory Pool)",
		CurrentUsagePct:     54.2,
		GrowthRatePerDayPct: 0.12,
		DaysToSaturation:    128,
		ThresholdLimitPct:   85.0,
		Recommendation:      "Memory allocation nominal. Garbage collection pace healthy.",
		Severity:            "HEALTHY",
		ProjectedDate:       time.Now().Add(128 * 24 * time.Hour),
	},
	{
		ResourceName:        "Kubernetes Node CPU Saturation",
		CurrentUsagePct:     42.1,
		GrowthRatePerDayPct: 0.28,
		DaysToSaturation:    89,
		ThresholdLimitPct:   80.0,
		Recommendation:      "HPA auto-scaler configured with 30% headroom buffer.",
		Severity:            "HEALTHY",
		ProjectedDate:       time.Now().Add(89 * 24 * time.Hour),
	},
	{
		ResourceName:        "Central Log File-Descriptor Capacity",
		CurrentUsagePct:     28.5,
		GrowthRatePerDayPct: 0.05,
		DaysToSaturation:    240,
		ThresholdLimitPct:   90.0,
		Recommendation:      "Ulimits configured properly across all collector daemons.",
		Severity:            "HEALTHY",
		ProjectedDate:       time.Now().Add(240 * 24 * time.Hour),
	},
}

var defaultFinOps = FinOpsCostSummary{
	TotalMonthlySpend:     14250.00,
	Currency:              "USD",
	ChangeVsLastMonthPct:  -4.2,
	EfficiencyScore:       88,
	EstimatedMonthlyWaste: 1840.00,
	BreakdownByProvider: map[string]float64{
		"AWS":       8420.00,
		"GCP":       3650.00,
		"Azure":     1480.00,
		"BareMetal": 700.00,
	},
	BreakdownByCategory: map[string]float64{
		"Compute (EC2/GKE)":   7820.00,
		"Managed Databases":   3950.00,
		"Storage & Snapshots": 1640.00,
		"Network Egress":      840.00,
	},
	Recommendations: []string{
		"Downscale 3 idle staging worker nodes during off-peak hours (Est. savings: $420/mo)",
		"Convert 4 under-utilized PostgreSQL standby replicas to GP3 storage (Est. savings: $280/mo)",
		"Apply 1-year Savings Plans for core ingestion cluster (Est. savings: $1,140/mo)",
	},
}

// GET /api/v1/capacity/forecasts
func HandleListForecasts(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		api.RespondJSON(w, http.StatusOK, defaultForecasts)
	}
}

// GET /api/v1/capacity/finops
func HandleGetFinOps(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		api.RespondJSON(w, http.StatusOK, defaultFinOps)
	}
}
