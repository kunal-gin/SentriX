package ai

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type CorrelatedSignal struct {
	Type        string    `json:"type"` // METRIC, ALERT, LOG, TRACE
	Source      string    `json:"source"`
	Severity    string    `json:"severity"`
	Description string    `json:"description"`
	Timestamp   time.Time `json:"timestamp"`
	MetricValue *float64  `json:"metric_value,omitempty"`
}

type RCAResponse struct {
	IncidentID            string             `json:"incident_id"`
	AnalyzedAt            time.Time          `json:"analyzed_at"`
	LikelyRootCause       string             `json:"likely_root_cause"`
	ConfidencePct         int                `json:"confidence_pct"`
	Summary               string             `json:"summary"`
	CorrelatedSignals     []CorrelatedSignal `json:"correlated_signals"`
	AffectedServices      []string           `json:"affected_services"`
	BlastRadius           string             `json:"blast_radius"`
	AlternativeHypotheses []string           `json:"alternative_hypotheses"`
	RecommendedAction     string             `json:"recommended_action"`
}

// GET /api/v1/incidents/{incidentID}/rca
func HandleGetIncidentRCA(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		incidentID := chi.URLParam(r, "incidentID")
		now := time.Now().UTC()

		metricVal1 := 96.4
		metricVal2 := 88.2

		resp := RCAResponse{
			IncidentID:      incidentID,
			AnalyzedAt:      now,
			LikelyRootCause: "PostgreSQL connection pool exhaustion due to slow unindexed query lock contention in payments-service",
			ConfidencePct:   89,
			Summary:         "At 14:31 UTC, database connection pool utilization peaked at 96.4% on srv-prod-db-primary, causing thread backlog and escalating HTTP 503 response bursts across payments and checkout gateways. Degradation cleared after unindexed query timeouts were aborted.",
			BlastRadius:     "3 microservices (Payments, Checkout, API Gateway), affecting approximately 4.2% of checkout transactions",
			AffectedServices: []string{
				"payments-service",
				"checkout-api",
				"api-gateway",
			},
			CorrelatedSignals: []CorrelatedSignal{
				{
					Type:        "METRIC",
					Source:      "db-primary-eu-west-1 (database.active_connections)",
					Severity:    "CRITICAL",
					Description: "Connection pool reached 96.4% saturation (482 / 500 connections in use)",
					Timestamp:   now.Add(-28 * time.Minute),
					MetricValue: &metricVal1,
				},
				{
					Type:        "ALERT",
					Source:      "Rule: Database Connection Pool Critical",
					Severity:    "CRITICAL",
					Description: "Alert fired: active_connections > 90% sustained for > 3m",
					Timestamp:   now.Add(-27 * time.Minute),
				},
				{
					Type:        "LOG",
					Source:      "db-primary-eu-west-1 (postgresql.log)",
					Severity:    "ERROR",
					Description: "FATAL: remaining connection slots are reserved for non-replication superuser connections",
					Timestamp:   now.Add(-26 * time.Minute),
				},
				{
					Type:        "TRACE",
					Source:      "payments-processor /api/v1/charge (Trace ID: trc-89a1b2c3d4)",
					Severity:    "WARNING",
					Description: "Database span 'SELECT * FROM payment_accounts FOR UPDATE' took 4,820ms (p99 normal: 12ms)",
					Timestamp:   now.Add(-25 * time.Minute),
				},
				{
					Type:        "METRIC",
					Source:      "api-gw-us-east-1 (http.server.requests.5xx)",
					Severity:    "HIGH",
					Description: "Error rate surged from 0.02% to 14.8% during connection spike",
					Timestamp:   now.Add(-24 * time.Minute),
					MetricValue: &metricVal2,
				},
			},
			AlternativeHypotheses: []string{
				"Traffic volume surge: Ingress requests increased by 18%, but remained within normal auto-scaling envelope.",
				"Network packet drop: Intra-cluster VPC latency was stable at 0.35ms with 0% packet drop.",
			},
			RecommendedAction: "Execute Runbook 'PostgreSQL Connection Pool Drain' and apply composite index on payment_accounts(tenant_id, account_status).",
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}
}

// POST /api/v1/incidents/{incidentID}/postmortem-ai
func HandleGeneratePostmortemAI(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		incidentID := chi.URLParam(r, "incidentID")
		now := time.Now().Format("2006-01-02 15:04 UTC")

		draft := fmt.Sprintf(`# SentriX Incident Postmortem — %s

## Incident Executive Summary
On **%s**, SentriX detected critical service degradation affecting the **Payments** and **Checkout** services. The incident was triggered by connection pool exhaustion on the primary database cluster (**db-primary-eu-west-1**), resulting in a temporary spike in HTTP 503 gateway responses.

## Timeline of Events
- **14:31 UTC**: Database connection utilization crossed 90%% threshold on primary database node.
- **14:32 UTC**: Alert 'Database Connection Pool Critical' transitioned from PENDING to FIRING (Fingerprint: `+"`db:pool:eu-west-1:p90`"+`).
- **14:33 UTC**: Incident **%s** automatically created and dispatched via PagerDuty to Infrastructure On-Call.
- **14:35 UTC**: Engineer acknowledged incident; investigated correlated traces identifying unindexed locking query on `+"`payment_accounts`"+`.
- **14:38 UTC**: Long-running locking transactions terminated; PgBouncer connection pool purged.
- **14:42 UTC**: Latency dropped below 25ms SLO target; incident marked RESOLVED.

## Root Cause Analysis
An unindexed `+"`SELECT ... FOR UPDATE`"+` query combined with a concurrent batch settlement run held transaction locks open, exhausting all 500 client slots. Incoming API requests blocked waiting for connections until upstream HTTP clients timed out.

## Impact
- **Total Duration**: 11 minutes
- **Services Affected**: Payments API, Checkout Gateway
- **Transaction Impact**: 4.2%% of checkout attempts received HTTP 503 errors and were automatically retried.

## Preventative Action Items
1. [ ] Add index on `+"`payment_accounts(tenant_id, account_status)`"+` (**Priority: P0**, Owner: Database Team)
2. [ ] Reduce query timeout on non-interactive worker queries to 3,000ms (**Priority: P1**, Owner: Backend Team)
3. [ ] Configure PgBouncer max pool client limits with reserve pool isolation (**Priority: P1**, Owner: DevOps)
`, incidentID, now, incidentID)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"incident_id": incidentID,
			"postmortem":  draft,
		})
	}
}
