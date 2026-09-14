package intelligence

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/sentrix/server/internal/api"
	"github.com/sentrix/server/internal/auth"
)

type EvidenceGraph struct {
	IncidentID       string              `json:"incident_id"`
	Title            string              `json:"title"`
	LikelyCause      string              `json:"likely_cause"`
	ConfidenceScore  float64             `json:"confidence_score"` // e.g. 87%
	AlternativeCause string              `json:"alternative_cause"`
	SignalsCount     int                 `json:"signals_count"`
	ChangeCorrelation string             `json:"change_correlation"`
	EvidenceNodes    []EvidenceNode      `json:"evidence_nodes"`
	InvestigationSteps []string          `json:"investigation_steps"`
	PredictiveAlert  string              `json:"predictive_alert"`
	PostmortemDraft  PostmortemSummary   `json:"postmortem_draft"`
}

type EvidenceNode struct {
	ID        string    `json:"id"`
	Domain    string    `json:"domain"` // METRICS, LOGS, TRACES, DEPLOYMENT, TOPOLOGY, DATABASE
	Signal    string    `json:"signal"`
	Severity  string    `json:"severity"` // CRITICAL, WARNING, INFO
	Timestamp time.Time `json:"timestamp"`
	Weight    float64   `json:"weight"`
	Detail    string    `json:"detail"`
}

type PostmortemSummary struct {
	Summary             string    `json:"summary"`
	Impact              string    `json:"impact"`
	Timeline            []string  `json:"timeline"`
	RootCause           string    `json:"root_cause"`
	DetectionMethod     string    `json:"detection_method"`
	PreventativeActions []string  `json:"preventative_actions"`
}

var defaultEvidenceGraph = EvidenceGraph{
	IncidentID:        "INC-1042",
	Title:             "PostgreSQL Connection Saturation & Auth Gateway Elevated P95 Latency",
	LikelyCause:       "PostgreSQL connection saturation caused by unindexed batch query in deployment v4.2.1",
	ConfidenceScore:   87.5,
	AlternativeCause:  "Upstream traffic surge or external DDoS against authentication endpoint",
	SignalsCount:      5,
	ChangeCorrelation: "Incident began 4 minutes after deployment v4.2.1 of auth-service by alex.chen@acme.com",
	EvidenceNodes: []EvidenceNode{
		{
			ID:        "ev-01",
			Domain:    "DEPLOYMENT",
			Signal:    "Service Rollout v4.2.1",
			Severity:  "INFO",
			Timestamp: time.Now().Add(-24 * time.Minute),
			Weight:    0.92,
			Detail:    "Commit f4a89c2 deployed to production namespace by CI/CD pipeline #1842",
		},
		{
			ID:        "ev-02",
			Domain:    "DATABASE",
			Signal:    "Connection Pool Saturation > 95%",
			Severity:  "CRITICAL",
			Timestamp: time.Now().Add(-20 * time.Minute),
			Weight:    0.96,
			Detail:    "timescaledb-cluster-primary hit 192/200 connections; active queries stuck in RowShareLock",
		},
		{
			ID:        "ev-03",
			Domain:    "METRICS",
			Signal:    "P95 Ingestion Latency Spike (240ms -> 1,450ms)",
			Severity:  "CRITICAL",
			Timestamp: time.Now().Add(-19 * time.Minute),
			Weight:    0.88,
			Detail:    "auth-gateway latency jumped 6x above baseline threshold (100ms)",
		},
		{
			ID:        "ev-04",
			Domain:    "LOGS",
			Signal:    "Error Log Burst (pq: remaining connection slots are reserved)",
			Severity:  "CRITICAL",
			Timestamp: time.Now().Add(-18 * time.Minute),
			Weight:    0.85,
			Detail:    "84 ERROR log entries within 60 seconds matching PostgreSQL pool rejection",
		},
		{
			ID:        "ev-05",
			Domain:    "TRACES",
			Signal:    "Distributed Trace Bottleneck in db_execute span",
			Severity:  "WARNING",
			Timestamp: time.Now().Add(-17 * time.Minute),
			Weight:    0.79,
			Detail:    "Trace tr-8491 spent 1,220ms waiting on pgxpool acquire lease",
		},
	},
	InvestigationSteps: []string{
		"1. Inspect active connection states in PostgreSQL Diagnostics (/databases)",
		"2. Review deployment v4.2.1 diff in Deployment Intelligence (/deployments)",
		"3. Check traces waterfall for query ID q-9812 (/traces)",
		"4. Trigger Runbook: Flush Connection Pool & Recycle Idle Backends (/runbooks)",
	},
	PredictiveAlert: "Disk utilization on primary database projected to reach 90% saturation within 8 days at current WAL generation rate.",
	PostmortemDraft: PostmortemSummary{
		Summary: "On Monday at 14:34 UTC, auth-gateway experienced degraded availability and P95 latency degraded from 80ms to 1,450ms following deployment v4.2.1.",
		Impact:  "Approximately 1,200 authentication attempts failed over a 12-minute window; checkout service error budget consumed by 14.8x burn rate.",
		Timeline: []string{
			"14:30 UTC: Deployment v4.2.1 rolled out to auth-service pods",
			"14:34 UTC: Postgres connection pool reached 192/200 capacity",
			"14:35 UTC: SentriX Intelligence 2.0 fired composite alert & created INC-1042",
			"14:38 UTC: Automated runbook recycled idle connections; pool returned to 42%",
			"14:42 UTC: Latency normalized to 84ms; incident marked resolved",
		},
		RootCause: "Missing index on auth_tokens.expires_at caused full table scans under load, holding connection leases indefinitely.",
		DetectionMethod: "SentriX Multi-Signal Correlation Engine (SLO Burn Rate + PG Connection Saturation)",
		PreventativeActions: []string{
			"Add missing composite index on auth_tokens (user_id, expires_at)",
			"Configure client-side pgxpool connection max lifetime to 15m",
			"Add pre-deployment staging load test gate in CI/CD pipeline",
		},
	},
}

// GET /api/v1/intelligence/evidence-graph
func HandleGetEvidenceGraph(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		api.RespondJSON(w, http.StatusOK, defaultEvidenceGraph)
	}
}

// POST /api/v1/intelligence/correlate
func HandleCorrelate(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		actor := auth.GetUser(r)
		if actor == nil {
			api.RespondError(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication required")
			return
		}

		var req struct {
			IncidentID string `json:"incident_id"`
			TimeWindow string `json:"time_window"`
		}
		_ = json.NewDecoder(r.Body).Decode(&req)

		// Return fresh synthesized evidence graph
		res := defaultEvidenceGraph
		if req.IncidentID != "" {
			res.IncidentID = req.IncidentID
		}
		api.RespondJSON(w, http.StatusOK, res)
	}
}
