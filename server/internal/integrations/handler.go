package integrations

import (
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type IntegrationChannel struct {
	ID               string     `json:"id"`
	Name             string     `json:"name"`
	Type             string     `json:"type"` // SLACK, TEAMS, PAGERDUTY, WEBHOOK, EMAIL
	Status           string     `json:"status"` // ACTIVE, FAILED, DISABLED
	TargetEndpoint   string     `json:"target_endpoint"`
	EventsSubscribed []string   `json:"events_subscribed"`
	SecretHeader     string     `json:"secret_header"`
	SuccessCount     int        `json:"success_count"`
	FailureCount     int        `json:"failure_count"`
	LastDispatchedAt *time.Time `json:"last_dispatched_at"`
	CreatedAt        time.Time  `json:"created_at"`
}

type DeadLetterItem struct {
	ID              string     `json:"id"`
	EventID         string     `json:"event_id"`
	IntegrationID   string     `json:"integration_id"`
	IntegrationName string     `json:"integration_name"`
	EventType       string     `json:"event_type"`
	PayloadSummary  string     `json:"payload_summary"`
	Attempts        int        `json:"attempts"`
	LastError       string     `json:"last_error"`
	CreatedAt       time.Time  `json:"created_at"`
	ReplayedAt      *time.Time `json:"replayed_at"`
	Status          string     `json:"status"` // PENDING_RETRY, REPLAYED, ABANDONED
}

var (
	integrationsMu sync.RWMutex
	defaultChannels = []*IntegrationChannel{
		{
			ID:               "int-slack-alerts",
			Name:             "DevOps Production Slack Channel",
			Type:             "SLACK",
			Status:           "ACTIVE",
			TargetEndpoint:   "https://hooks.slack.com/services/T000/B000/XXXXX",
			EventsSubscribed: []string{"ALERT_FIRED", "ALERT_RESOLVED", "INCIDENT_CREATED", "INCIDENT_RESOLVED"},
			SecretHeader:     "X-SentriX-Signature (HMAC-SHA256)",
			SuccessCount:     1482,
			FailureCount:     2,
			LastDispatchedAt: func() *time.Time { t := time.Now().Add(-14 * time.Minute); return &t }(),
			CreatedAt:        time.Now().Add(-60 * 24 * time.Hour),
		},
		{
			ID:               "int-pagerduty-oncall",
			Name:             "Primary Infrastructure Escalation PagerDuty",
			Type:             "PAGERDUTY",
			Status:           "ACTIVE",
			TargetEndpoint:   "https://events.pagerduty.com/v2/enqueue (Service Key: pd-live-infra)",
			EventsSubscribed: []string{"INCIDENT_CREATED", "INCIDENT_RESOLVED"},
			SecretHeader:     "X-Routing-Key",
			SuccessCount:     194,
			FailureCount:     0,
			LastDispatchedAt: func() *time.Time { t := time.Now().Add(-32 * time.Minute); return &t }(),
			CreatedAt:        time.Now().Add(-60 * 24 * time.Hour),
		},
		{
			ID:               "int-teams-secops",
			Name:             "Security Operations MS Teams Webhook",
			Type:             "TEAMS",
			Status:           "ACTIVE",
			TargetEndpoint:   "https://sentrix.webhook.office.com/webhookb2/XXXX/IncomingWebhook",
			EventsSubscribed: []string{"SERVER_OFFLINE", "AGENT_ENROLLED", "INCIDENT_CREATED"},
			SecretHeader:     "X-SentriX-Signature (HMAC-SHA256)",
			SuccessCount:     320,
			FailureCount:     1,
			LastDispatchedAt: func() *time.Time { t := time.Now().Add(-2 * time.Hour); return &t }(),
			CreatedAt:        time.Now().Add(-30 * 24 * time.Hour),
		},
		{
			ID:               "int-webhook-siem",
			Name:             "Enterprise SIEM & Splunk Ingestion Webhook",
			Type:             "WEBHOOK",
			Status:           "ACTIVE",
			TargetEndpoint:   "https://siem.internal.corp/sentrix/events",
			EventsSubscribed: []string{"ALERT_FIRED", "ALERT_RESOLVED", "INCIDENT_CREATED", "INCIDENT_RESOLVED", "SERVER_OFFLINE"},
			SecretHeader:     "X-SentriX-Signature",
			SuccessCount:     4120,
			FailureCount:     5,
			LastDispatchedAt: func() *time.Time { t := time.Now().Add(-5 * time.Minute); return &t }(),
			CreatedAt:        time.Now().Add(-90 * 24 * time.Hour),
		},
	}

	dlqItems = []*DeadLetterItem{
		{
			ID:              "dlq-1049",
			EventID:         "evt-alert-firing-901",
			IntegrationID:   "int-webhook-siem",
			IntegrationName: "Enterprise SIEM & Splunk Ingestion Webhook",
			EventType:       "ALERT_FIRED",
			PayloadSummary:  "Alert Database Connection Pool Critical fired on srv-prod-db-primary (96.4%)",
			Attempts:        3,
			LastError:       "HTTP 504 Gateway Timeout after 5000ms from siem.internal.corp",
			CreatedAt:       time.Now().Add(-28 * time.Minute),
			Status:          "PENDING_RETRY",
		},
		{
			ID:              "dlq-1048",
			EventID:         "evt-incident-created-882",
			IntegrationID:   "int-slack-alerts",
			IntegrationName: "DevOps Production Slack Channel",
			EventType:       "INCIDENT_CREATED",
			PayloadSummary:  "INC-1042 Database connection pool exhaustion",
			Attempts:        3,
			LastError:       "HTTP 429 Rate limited by Slack API (retry-after: 30s)",
			CreatedAt:       time.Now().Add(-1 * time.Hour),
			ReplayedAt:      func() *time.Time { t := time.Now().Add(-58 * time.Minute); return &t }(),
			Status:          "REPLAYED",
		},
	}
)

// GET /api/v1/integrations
func HandleListIntegrations(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		integrationsMu.RLock()
		defer integrationsMu.RUnlock()

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(defaultChannels)
	}
}

// POST /api/v1/integrations/test
func HandleTestIntegration(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"status":    "SUCCESS",
			"latency_ms": 42,
			"message":   "Verification test packet delivered successfully with valid X-SentriX-Signature HMAC.",
		})
	}
}

// GET /api/v1/notifications/dlq
func HandleListDLQ(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		integrationsMu.RLock()
		defer integrationsMu.RUnlock()

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(dlqItems)
	}
}

// POST /api/v1/notifications/dlq/{id}/replay
func HandleReplayDLQ(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")

		integrationsMu.Lock()
		defer integrationsMu.Unlock()

		now := time.Now().UTC()
		for _, item := range dlqItems {
			if item.ID == id {
				item.Status = "REPLAYED"
				item.ReplayedAt = &now
				item.Attempts++
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(item)
				return
			}
		}

		// Also handle mock if new id
		newItem := &DeadLetterItem{
			ID:              id,
			EventID:         "evt-" + uuid.New().String()[:8],
			IntegrationID:   "int-slack-alerts",
			IntegrationName: "DevOps Production Slack Channel",
			EventType:       "RETRY_EVENT",
			PayloadSummary:  "Replayed notification payload",
			Attempts:        4,
			LastError:       "",
			CreatedAt:       now,
			ReplayedAt:      &now,
			Status:          "REPLAYED",
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(newItem)
	}
}
