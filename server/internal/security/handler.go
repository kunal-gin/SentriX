package security

import (
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type SecurityEvent struct {
	ID        string    `json:"id"`
	EventType string    `json:"event_type"` // FAILED_LOGIN, SUSPICIOUS_IP, SESSION_REVOKED, CREDENTIAL_ROTATED, PERMISSION_CHANGED, REPLAY_ATTEMPT
	Severity  string    `json:"severity"`   // LOW, MEDIUM, HIGH, CRITICAL
	Actor     string    `json:"actor"`
	SourceIP  string    `json:"source_ip"`
	Details   string    `json:"details"`
	Timestamp time.Time `json:"timestamp"`
}

type ActiveSession struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	UserEmail string    `json:"user_email"`
	Role      string    `json:"role"`
	Device    string    `json:"device"`
	IPAddress string    `json:"ip_address"`
	Location  string    `json:"location"`
	CreatedAt time.Time `json:"created_at"`
	LastSeen  time.Time `json:"last_seen"`
}

type SSOConfig struct {
	Provider     string    `json:"provider"` // SAML_2_0, OIDC, SCIM_2_0
	Status       string    `json:"status"`   // CONFIGURED, ACTIVE, INACTIVE
	EntityID     string    `json:"entity_id"`
	SSOEndpoint  string    `json:"sso_endpoint"`
	Issuer       string    `json:"issuer"`
	LastSyncedAt time.Time `json:"last_synced_at"`
}

var (
	secMu    sync.RWMutex
	sessions = []*ActiveSession{
		{
			ID:        "sess-admin-01",
			UserID:    "usr-admin-demo",
			UserEmail: "admin@sentrix.local",
			Role:      "ADMIN",
			Device:    "Chrome 128 (macOS Sonoma / ARM64)",
			IPAddress: "192.168.1.42",
			Location:  "New York, USA",
			CreatedAt: time.Now().Add(-6 * time.Hour),
			LastSeen:  time.Now().Add(-1 * time.Minute),
		},
		{
			ID:        "sess-sre-02",
			UserID:    "usr-sre-lead",
			UserEmail: "sre.oncall@sentrix.local",
			Role:      "OPERATOR",
			Device:    "Firefox 130 (Ubuntu Linux / x86_64)",
			IPAddress: "10.14.88.19",
			Location:  "Frankfurt, Germany",
			CreatedAt: time.Now().Add(-12 * time.Hour),
			LastSeen:  time.Now().Add(-4 * time.Minute),
		},
		{
			ID:        "sess-viewer-03",
			UserID:    "usr-devops-01",
			UserEmail: "devops@sentrix.local",
			Role:      "VIEWER",
			Device:    "Safari 17 (iOS 18 / iPhone 16)",
			IPAddress: "172.56.21.90",
			Location:  "London, UK",
			CreatedAt: time.Now().Add(-2 * time.Hour),
			LastSeen:  time.Now().Add(-15 * time.Minute),
		},
	}

	securityEvents = []*SecurityEvent{
		{
			ID:        "sec-evt-9901",
			EventType: "FAILED_LOGIN",
			Severity:  "MEDIUM",
			Actor:     "unknown_entity@attacker.net",
			SourceIP:  "198.51.100.74",
			Details:   "Multiple invalid password attempts blocked by rate limiting firewall",
			Timestamp: time.Now().Add(-18 * time.Minute),
		},
		{
			ID:        "sec-evt-9902",
			EventType: "CREDENTIAL_ROTATED",
			Severity:  "LOW",
			Actor:     "admin@sentrix.local",
			SourceIP:  "192.168.1.42",
			Details:   "Rotated mTLS token for agent agt-eu-west-db-01",
			Timestamp: time.Now().Add(-45 * time.Minute),
		},
		{
			ID:        "sec-evt-9903",
			EventType: "SUSPICIOUS_IP",
			Severity:  "HIGH",
			Actor:     "system:waf",
			SourceIP:  "203.0.113.195",
			Details:   "Anomalous burst of 450 requests/sec flagged and throttled by perimeter shield",
			Timestamp: time.Now().Add(-2 * time.Hour),
		},
		{
			ID:        "sec-evt-9904",
			EventType: "PERMISSION_CHANGED",
			Severity:  "LOW",
			Actor:     "admin@sentrix.local",
			SourceIP:  "192.168.1.42",
			Details:   "Granted runbooks.execute scope to role OPERATOR",
			Timestamp: time.Now().Add(-5 * time.Hour),
		},
	}

	ssoConfigs = []SSOConfig{
		{
			Provider:     "SAML_2_0",
			Status:       "ACTIVE",
			EntityID:     "urn:sentrix:auth:saml2",
			SSOEndpoint:  "https://login.microsoftonline.com/common/saml2",
			Issuer:       "https://sts.windows.net/sentrix-tenant/",
			LastSyncedAt: time.Now().Add(-1 * time.Hour),
		},
		{
			Provider:     "OIDC",
			Status:       "CONFIGURED",
			EntityID:     "https://accounts.google.com/.well-known/openid-configuration",
			SSOEndpoint:  "https://accounts.google.com/o/oauth2/v2/auth",
			Issuer:       "https://accounts.google.com",
			LastSyncedAt: time.Now().Add(-3 * time.Hour),
		},
		{
			Provider:     "SCIM_2_0",
			Status:       "ACTIVE",
			EntityID:     "https://api.sentrix.io/scim/v2",
			SSOEndpoint:  "https://api.sentrix.io/scim/v2/Users",
			Issuer:       "SentriX SCIM Directory Provisioner",
			LastSyncedAt: time.Now().Add(-30 * time.Minute),
		},
	}
)

// GET /api/v1/security/events
func HandleListSecurityEvents(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		secMu.RLock()
		defer secMu.RUnlock()

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(securityEvents)
	}
}

// GET /api/v1/security/sessions
func HandleListSessions(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		secMu.RLock()
		defer secMu.RUnlock()

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(sessions)
	}
}

// POST /api/v1/security/sessions/{id}/revoke
func HandleRevokeSession(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")

		secMu.Lock()
		defer secMu.Unlock()

		filtered := make([]*ActiveSession, 0, len(sessions))
		var revoked *ActiveSession
		for _, s := range sessions {
			if s.ID == id {
				revoked = s
			} else {
				filtered = append(filtered, s)
			}
		}
		sessions = filtered

		if revoked != nil {
			securityEvents = append([]*SecurityEvent{
				{
					ID:        "sec-evt-revoke-" + id,
					EventType: "SESSION_REVOKED",
					Severity:  "HIGH",
					Actor:     "admin@sentrix.local",
					SourceIP:  r.RemoteAddr,
					Details:   "Session revoked for user " + revoked.UserEmail + " (" + revoked.Device + ")",
					Timestamp: time.Now().UTC(),
				},
			}, securityEvents...)
		}

		w.WriteHeader(http.StatusNoContent)
	}
}

// GET /api/v1/security/sso
func HandleGetSSOConfig(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(ssoConfigs)
	}
}
