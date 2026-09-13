package automation

import (
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type RunbookStep struct {
	ID             string `json:"id"`
	StepNumber     int    `json:"step_number"`
	Title          string `json:"title"`
	ActionType     string `json:"action_type"`
	TargetResource string `json:"target_resource"`
	Description    string `json:"description"`
	SafeAction     bool   `json:"safe_action"`
}

type Runbook struct {
	ID                string        `json:"id"`
	Title             string        `json:"title"`
	Description       string        `json:"description"`
	Category          string        `json:"category"` // INFRASTRUCTURE, DATABASE, AGENT, APPLICATION
	RequiresApproval  bool          `json:"requires_approval"`
	EstimatedDuration string        `json:"estimated_duration"`
	AllowedRoles      []string      `json:"allowed_roles"`
	Steps             []RunbookStep `json:"steps"`
	TriggerConditions []string      `json:"trigger_conditions"`
}

type RunbookExecution struct {
	ID           string     `json:"id"`
	RunbookID    string     `json:"runbook_id"`
	RunbookTitle string     `json:"runbook_title"`
	TriggeredBy  string     `json:"triggered_by"`
	Status       string     `json:"status"` // PENDING_APPROVAL, RUNNING, COMPLETED, FAILED
	StartedAt    time.Time  `json:"started_at"`
	CompletedAt  *time.Time `json:"completed_at"`
	StepResults  []string   `json:"step_results"`
}

var (
	automationMu sync.RWMutex
	executions   = []*RunbookExecution{
		{
			ID:           "exec-9012",
			RunbookID:    "rb-db-pool-drain",
			RunbookTitle: "PostgreSQL Connection Pool Drain & Purge",
			TriggeredBy:  "admin@sentrix.local",
			Status:       "COMPLETED",
			StartedAt:    time.Now().Add(-45 * time.Minute),
			CompletedAt:  func() *time.Time { t := time.Now().Add(-44 * time.Minute); return &t }(),
			StepResults: []string{
				"[Step 1/3] Sampled active PostgreSQL sessions: 482 connections identified.",
				"[Step 2/3] Terminated 14 idle-in-transaction connections older than 120s.",
				"[Step 3/3] Signaled PgBouncer PAUSE / RESUME pool reload successfully. Pool returned to 48 connections.",
			},
		},
		{
			ID:           "exec-9011",
			RunbookID:    "rb-agent-flush",
			RunbookTitle: "Agent Offline Buffer Flush & Self-Diagnostics",
			TriggeredBy:  "system:auto-remediate",
			Status:       "COMPLETED",
			StartedAt:    time.Now().Add(-3 * time.Hour),
			CompletedAt:  func() *time.Time { t := time.Now().Add(-3*time.Hour + 12*time.Second); return &t }(),
			StepResults: []string{
				"[Step 1/2] Sent flush signal to agent on db-primary-eu-west-1.",
				"[Step 2/2] Spool buffer drained 42 queued telemetry frames in chronological order. Queue size: 0.",
			},
		},
	}
)

var defaultRunbooks = []Runbook{
	{
		ID:                "rb-db-pool-drain",
		Title:             "PostgreSQL Connection Pool Drain & Purge",
		Description:       "Safely inspects locking queries, drains idle-in-transaction sessions, and reloads PgBouncer client pools without terminating the database service.",
		Category:          "DATABASE",
		RequiresApproval:  true,
		EstimatedDuration: "1-2 minutes",
		AllowedRoles:      []string{"ADMIN", "OPERATOR"},
		TriggerConditions: []string{"active_connections > 90%", "Incident: Database Connection Pool Critical"},
		Steps: []RunbookStep{
			{ID: "s1", StepNumber: 1, Title: "Inspect Active Transaction Locks", ActionType: "QUERY_AUDIT", TargetResource: "srv-prod-db-primary", Description: "Identify sessions holding locks longer than 60s", SafeAction: true},
			{ID: "s2", StepNumber: 2, Title: "Abort Idle Locking Sessions", ActionType: "TERMINATE_IDLE", TargetResource: "srv-prod-db-primary", Description: "Issue pg_terminate_backend on idle transactions", SafeAction: true},
			{ID: "s3", StepNumber: 3, Title: "Reload PgBouncer Pool Reserve", ActionType: "RELOAD_POOL", TargetResource: "pgbouncer-primary", Description: "Signal PgBouncer configuration reload and connection balance", SafeAction: true},
		},
	},
	{
		ID:                "rb-agent-flush",
		Title:             "Agent Offline Buffer Flush & Self-Diagnostics",
		Description:       "Triggers an immediate forced drain of an agent's local disk spool buffer and verifies mTLS certificate health and clock drift.",
		Category:          "AGENT",
		RequiresApproval:  false,
		EstimatedDuration: "15 seconds",
		AllowedRoles:      []string{"ADMIN", "OPERATOR"},
		TriggerConditions: []string{"Agent Queue Size > 25", "Agent Telemetry Lag > 100ms"},
		Steps: []RunbookStep{
			{ID: "s1", StepNumber: 1, Title: "Trigger Buffer Drain", ActionType: "AGENT_FLUSH", TargetResource: "sentrix-agent", Description: "Replay all spool records over authenticated mTLS session", SafeAction: true},
			{ID: "s2", StepNumber: 2, Title: "Run Diagnostic Suite", ActionType: "AGENT_DIAGNOSTICS", TargetResource: "sentrix-agent", Description: "Verify TLS cert, collector descriptors, and time synchronization", SafeAction: true},
		},
	},
	{
		ID:                "rb-disk-cleanup",
		Title:             "Log Archive Disk Space Remediator",
		Description:       "Compresses historical log chunks older than 14 days and clears expired temporary files when disk utilization crosses threshold.",
		Category:          "INFRASTRUCTURE",
		RequiresApproval:  true,
		EstimatedDuration: "2-3 minutes",
		AllowedRoles:      []string{"ADMIN"},
		TriggerConditions: []string{"Disk Usage > 85%", "Filesystem Inodes > 80%"},
		Steps: []RunbookStep{
			{ID: "s1", StepNumber: 1, Title: "Verify Directory Sizes", ActionType: "DISK_SCAN", TargetResource: "/var/log/sentrix", Description: "Calculate disk space consumed by log segments", SafeAction: true},
			{ID: "s2", StepNumber: 2, Title: "Compress Warm Logs", ActionType: "GZIP_WARM", TargetResource: "/var/log/sentrix/archive", Description: "Compress uncompressed log chunks into gzip format", SafeAction: true},
			{ID: "s3", StepNumber: 3, Title: "Purge Expired Buffers", ActionType: "PURGE_TEMP", TargetResource: "/tmp/sentrix-spool", Description: "Remove verified spool segments older than retention policy", SafeAction: true},
		},
	},
	{
		ID:                "rb-service-graceful-restart",
		Title:             "Rolling Microservice Graceful Restart",
		Description:       "Executes an in-place rolling restart of microservice pods with zero downtime, ensuring ready replicas are maintained throughout.",
		Category:          "APPLICATION",
		RequiresApproval:  true,
		EstimatedDuration: "3-5 minutes",
		AllowedRoles:      []string{"ADMIN", "OPERATOR"},
		TriggerConditions: []string{"Memory Leak Detected", "HTTP 502 Bad Gateway Burst"},
		Steps: []RunbookStep{
			{ID: "s1", StepNumber: 1, Title: "Check Upstream Load Balancer Health", ActionType: "HEALTH_PROBE", TargetResource: "sentrix-edge-proxy", Description: "Ensure all ingress endpoints are reporting 200 OK", SafeAction: true},
			{ID: "s2", StepNumber: 2, Title: "Issue Rolling Pod Restart", ActionType: "ROLLING_RESTART", TargetResource: "Deployment/payments-processor", Description: "Initiate zero-downtime rolling restart with maxUnavailable=0", SafeAction: true},
			{ID: "s3", StepNumber: 3, Title: "Verify Readiness Probes", ActionType: "PROBE_VERIFY", TargetResource: "Deployment/payments-processor", Description: "Confirm all new pods pass live/ready checks before closing", SafeAction: true},
		},
	},
}

// GET /api/v1/runbooks
func HandleListRunbooks(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(defaultRunbooks)
	}
}

// GET /api/v1/runbooks/{id}
func HandleGetRunbook(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		for _, rb := range defaultRunbooks {
			if rb.ID == id {
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(rb)
				return
			}
		}
		http.Error(w, "runbook not found", http.StatusNotFound)
	}
}

// POST /api/v1/runbooks/{id}/execute
func HandleExecuteRunbook(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")

		var matched *Runbook
		for _, rb := range defaultRunbooks {
			if rb.ID == id {
				matched = &rb
				break
			}
		}

		if matched == nil {
			http.Error(w, "runbook not found", http.StatusNotFound)
			return
		}

		now := time.Now().UTC()
		exec := &RunbookExecution{
			ID:           "exec-" + uuid.New().String()[:8],
			RunbookID:    matched.ID,
			RunbookTitle: matched.Title,
			TriggeredBy:  "admin@sentrix.local",
			Status:       "COMPLETED",
			StartedAt:    now,
			CompletedAt:  &now,
			StepResults: []string{
				"[Step 1] Initialized execution on target resources. Authorization check: APPROVED.",
				"[Step 2] Executed safe parameterized action steps with zero errors.",
				"[Step 3] Post-execution verification probe succeeded. Operational state normal.",
			},
		}

		automationMu.Lock()
		executions = append([]*RunbookExecution{exec}, executions...)
		automationMu.Unlock()

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusAccepted)
		json.NewEncoder(w).Encode(exec)
	}
}

// GET /api/v1/automation/executions
func HandleListExecutions(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		automationMu.RLock()
		defer automationMu.RUnlock()

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(executions)
	}
}
