package demo

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"math/rand"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/sentrix/server/internal/auth"
	"github.com/sentrix/server/internal/realtime"
)

type DemoServer struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Hostname  string    `json:"hostname"`
	Platform  string    `json:"platform"`
	Status    string    `json:"status"` // ONLINE, SUSPECT, OFFLINE
	LastSeen  time.Time `json:"last_seen"`
	CPU       float64   `json:"cpu"`
	Memory    float64   `json:"memory"`
	Disk      float64   `json:"disk"`
}

type DemoIncident struct {
	ID             string     `json:"id"`
	ServerID       string     `json:"server_id"`
	ServerName     string     `json:"server_name"`
	Title          string     `json:"title"`
	Severity       string     `json:"severity"` // CRITICAL, WARNING, INFO
	Status         string     `json:"status"`   // OPEN, ACKNOWLEDGED, RESOLVED
	StartedAt      time.Time  `json:"started_at"`
	AcknowledgedAt *time.Time `json:"acknowledged_at"`
	ResolvedAt     *time.Time `json:"resolved_at"`
	Comments       []string   `json:"comments,omitempty"`
}

type DemoAlertRule struct {
	ID              string    `json:"id"`
	Name            string    `json:"name"`
	Metric          string    `json:"metric"`
	Operator        string    `json:"operator"`
	Threshold       float64   `json:"threshold"`
	WindowSeconds   int       `json:"window_seconds"`
	Severity        string    `json:"severity"`
	Enabled         bool      `json:"enabled"`
	CooldownSeconds int       `json:"cooldown_seconds"`
	CreatedAt       time.Time `json:"created_at"`
}

type DemoCheck struct {
	ID                  string     `json:"id"`
	ServerID            string     `json:"server_id"`
	ServerName          string     `json:"server_name"`
	Type                string     `json:"type"` // PROCESS, SERVICE, PORT, COMMAND
	Name                string     `json:"name"`
	Enabled             bool       `json:"enabled"`
	IntervalSeconds     int        `json:"interval_seconds"`
	TimeoutSeconds      int        `json:"timeout_seconds"`
	FailureThreshold    int        `json:"failure_threshold"`
	SuccessThreshold    int        `json:"success_threshold"`
	Severity            string     `json:"severity"`
	Config              any        `json:"config"`
	State               string     `json:"state"` // HEALTHY, DEGRADED, FAILING
	ConsecutiveFailures int        `json:"consecutive_failures"`
	LastMessage         string     `json:"last_message"`
	LastResultAt        time.Time  `json:"last_result_at"`
	CreatedAt           time.Time  `json:"created_at"`
}

type DemoUser struct {
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	Role      string    `json:"role"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
}

type DemoChannel struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Type      string    `json:"type"`
	Config    any       `json:"config"`
	Enabled   bool      `json:"enabled"`
	CreatedAt time.Time `json:"created_at"`
}

type DemoSilence struct {
	ID         string    `json:"id"`
	ServerID   *string   `json:"server_id,omitempty"`
	ServerName *string   `json:"server_name,omitempty"`
	RuleID     *string   `json:"rule_id,omitempty"`
	RuleName   *string   `json:"rule_name,omitempty"`
	Reason     string    `json:"reason"`
	StartsAt   time.Time `json:"starts_at"`
	EndsAt     time.Time `json:"ends_at"`
	CreatedAt  time.Time `json:"created_at"`
	Active     bool      `json:"active"`
}

type DemoAuditLog struct {
	ID           string         `json:"id"`
	ActorID      *string        `json:"actor_id,omitempty"`
	ActorEmail   *string        `json:"actor_email,omitempty"`
	Action       string         `json:"action"`
	ResourceType *string        `json:"resource_type,omitempty"`
	ResourceID   *string        `json:"resource_id,omitempty"`
	IPAddress    *string        `json:"ip_address,omitempty"`
	Details      map[string]any `json:"details"`
	CreatedAt    time.Time      `json:"created_at"`
}

type DemoProcess struct {
	PID       int     `json:"pid"`
	Name      string  `json:"name"`
	User      string  `json:"user"`
	CPU       float64 `json:"cpu"`
	MemoryRSS string  `json:"memory_rss"`
	State     string  `json:"state"`
}

type DemoLogEntry struct {
	Timestamp time.Time `json:"timestamp"`
	Level     string    `json:"level"`
	Unit      string    `json:"unit"`
	Message   string    `json:"message"`
}

type DemoStore struct {
	mu         sync.RWMutex
	servers    map[string]*DemoServer
	incidents  map[string]*DemoIncident
	alertRules map[string]*DemoAlertRule
	checks     map[string]*DemoCheck
	users      map[string]*DemoUser
	channels   map[string]*DemoChannel
	silences   map[string]*DemoSilence
	auditLogs  []*DemoAuditLog
}

var store *DemoStore

func initStore() {
	if store != nil {
		return
	}

	now := time.Now().UTC()
	ackTime := now.Add(-12 * time.Minute)

	s1 := &DemoServer{
		ID:       "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
		Name:     "production-api-01",
		Hostname: "api-prod-us-east-1.internal",
		Platform: "linux (Ubuntu 24.04 LTS)",
		Status:   "ONLINE",
		LastSeen: now,
		CPU:      34.2,
		Memory:   62.8,
		Disk:     41.5,
	}

	s2 := &DemoServer{
		ID:       "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
		Name:     "timescale-db-cluster-01",
		Hostname: "db-primary-us-east-1.internal",
		Platform: "linux (Debian 12 Bookworm)",
		Status:   "SUSPECT",
		LastSeen: now,
		CPU:      78.4,
		Memory:   89.1,
		Disk:     82.0,
	}

	s3 := &DemoServer{
		ID:       "c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f",
		Name:     "worker-queue-runner-01",
		Hostname: "worker-01.internal",
		Platform: "linux (Alpine 3.20)",
		Status:   "ONLINE",
		LastSeen: now,
		CPU:      18.9,
		Memory:   42.3,
		Disk:     26.7,
	}

	s4 := &DemoServer{
		ID:       "d4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a",
		Name:     "edge-ingress-proxy-02",
		Hostname: "edge-02.internal",
		Platform: "linux (Ubuntu 22.04 LTS)",
		Status:   "ONLINE",
		LastSeen: now,
		CPU:      12.1,
		Memory:   31.4,
		Disk:     19.8,
	}

	inc1 := &DemoIncident{
		ID:             "inc-001",
		ServerID:       s2.ID,
		ServerName:     s2.Name,
		Title:          "Memory utilization exceeded 85% threshold",
		Severity:       "WARNING",
		Status:         "ACKNOWLEDGED",
		StartedAt:      now.Add(-45 * time.Minute),
		AcknowledgedAt: &ackTime,
		Comments: []string{
			"Investigating Postgres buffer pool cache pressure. Queries look healthy.",
		},
	}

	r1 := &DemoAlertRule{
		ID:              "rule-001",
		Name:            "High CPU Utilization",
		Metric:          "system.cpu.utilization",
		Operator:        ">",
		Threshold:       85.0,
		WindowSeconds:   60,
		Severity:        "CRITICAL",
		Enabled:         true,
		CooldownSeconds: 300,
		CreatedAt:       now.Add(-72 * time.Hour),
	}

	r2 := &DemoAlertRule{
		ID:              "rule-002",
		Name:            "High Memory Utilization",
		Metric:          "system.memory.utilization",
		Operator:        ">",
		Threshold:       85.0,
		WindowSeconds:   120,
		Severity:        "WARNING",
		Enabled:         true,
		CooldownSeconds: 300,
		CreatedAt:       now.Add(-72 * time.Hour),
	}

	r3 := &DemoAlertRule{
		ID:              "rule-003",
		Name:            "Disk Space Critical",
		Metric:          "system.disk.utilization",
		Operator:        ">",
		Threshold:       90.0,
		WindowSeconds:   300,
		Severity:        "CRITICAL",
		Enabled:         true,
		CooldownSeconds: 600,
		CreatedAt:       now.Add(-72 * time.Hour),
	}

	chk1 := &DemoCheck{
		ID:                  "chk-001",
		ServerID:            s1.ID,
		ServerName:          s1.Name,
		Type:                "PROCESS",
		Name:                "SentriX Agent Process Check",
		Enabled:             true,
		IntervalSeconds:     15,
		TimeoutSeconds:      5,
		FailureThreshold:    3,
		SuccessThreshold:    1,
		Severity:            "CRITICAL",
		Config:              map[string]any{"process_name": "sentrix-agent"},
		State:               "HEALTHY",
		ConsecutiveFailures: 0,
		LastMessage:         "process is running (pid 1420)",
		LastResultAt:        now,
		CreatedAt:           now.Add(-48 * time.Hour),
	}

	chk2 := &DemoCheck{
		ID:                  "chk-002",
		ServerID:            s2.ID,
		ServerName:          s2.Name,
		Type:                "PORT",
		Name:                "TimescaleDB TCP Port 5432 Check",
		Enabled:             true,
		IntervalSeconds:     10,
		TimeoutSeconds:      3,
		FailureThreshold:    2,
		SuccessThreshold:    1,
		Severity:            "CRITICAL",
		Config:              map[string]any{"host": "127.0.0.1", "port": 5432},
		State:               "HEALTHY",
		ConsecutiveFailures: 0,
		LastMessage:         "port 5432 open, response time 1.2ms",
		LastResultAt:        now,
		CreatedAt:           now.Add(-48 * time.Hour),
	}

	store = &DemoStore{
		servers: map[string]*DemoServer{
			s1.ID: s1,
			s2.ID: s2,
			s3.ID: s3,
			s4.ID: s4,
		},
		incidents: map[string]*DemoIncident{
			inc1.ID: inc1,
		},
		alertRules: map[string]*DemoAlertRule{
			r1.ID: r1,
			r2.ID: r2,
			r3.ID: r3,
		},
		checks: map[string]*DemoCheck{
			chk1.ID: chk1,
			chk2.ID: chk2,
		},
		users: map[string]*DemoUser{
			"usr-admin-demo": {
				ID:        "usr-admin-demo",
				Email:     "admin@sentrix.local",
				Role:      "ADMIN",
				Status:    "ACTIVE",
				CreatedAt: now.Add(-720 * time.Hour),
			},
		},
		channels: map[string]*DemoChannel{
			"chan-webhook-demo": {
				ID:        "chan-webhook-demo",
				Name:      "DevOps Incident Webhook",
				Type:      "WEBHOOK",
				Config:    map[string]any{"url": "https://hooks.slack.com/services/demo/sentrix"},
				Enabled:   true,
				CreatedAt: now.Add(-120 * time.Hour),
			},
		},
		silences: map[string]*DemoSilence{
			"sil-demo-001": {
				ID:         "sil-demo-001",
				ServerID:   &s2.ID,
				ServerName: &s2.Name,
				Reason:     "Postgres WAL compaction and database index vacuum",
				StartsAt:   now.Add(-30 * time.Minute),
				EndsAt:     now.Add(90 * time.Minute),
				CreatedAt:  now.Add(-30 * time.Minute),
				Active:     true,
			},
		},
		auditLogs: []*DemoAuditLog{
			{
				ID:         "aud-001",
				ActorEmail: func() *string { s := "admin@sentrix.local"; return &s }(),
				Action:     "USER_LOGIN",
				IPAddress:  func() *string { s := "192.168.1.105"; return &s }(),
				Details:    map[string]any{"method": "password", "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"},
				CreatedAt:  now.Add(-15 * time.Minute),
			},
			{
				ID:           "aud-002",
				ActorEmail:   func() *string { s := "admin@sentrix.local"; return &s }(),
				Action:       "SILENCE_CREATED",
				ResourceType: func() *string { s := "SERVER"; return &s }(),
				ResourceID:   &s2.ID,
				IPAddress:    func() *string { s := "192.168.1.105"; return &s }(),
				Details:      map[string]any{"duration": "120m", "reason": "Postgres WAL compaction"},
				CreatedAt:    now.Add(-30 * time.Minute),
			},
			{
				ID:           "aud-003",
				ActorEmail:   func() *string { s := "admin@sentrix.local"; return &s }(),
				Action:       "RULE_CREATED",
				ResourceType: func() *string { s := "ALERT_RULE"; return &s }(),
				IPAddress:    func() *string { s := "192.168.1.105"; return &s }(),
				Details:      map[string]any{"name": "High CPU Threshold", "metric": "system.cpu.utilization", "threshold": 85},
				CreatedAt:    now.Add(-2 * time.Hour),
			},
			{
				ID:           "aud-004",
				ActorEmail:   func() *string { s := "system"; return &s }(),
				Action:       "AGENT_ENROLLED",
				ResourceType: func() *string { s := "AGENT"; return &s }(),
				ResourceID:   &s3.ID,
				IPAddress:    func() *string { s := "10.0.4.12"; return &s }(),
				Details:      map[string]any{"hostname": "worker-01.internal", "platform": "linux (Alpine 3.20)"},
				CreatedAt:    now.Add(-5 * time.Hour),
			},
			{
				ID:           "aud-005",
				ActorEmail:   func() *string { s := "admin@sentrix.local"; return &s }(),
				Action:       "CHANNEL_TEST_DISPATCHED",
				ResourceType: func() *string { s := "NOTIFICATION_CHANNEL"; return &s }(),
				IPAddress:    func() *string { s := "192.168.1.105"; return &s }(),
				Details:      map[string]any{"channel": "DevOps Incident Webhook", "status_code": 200},
				CreatedAt:    now.Add(-24 * time.Hour),
			},
		},
	}
}

func StartSimulator(ctx context.Context, bus *realtime.Bus) {
	initStore()
	ticker := time.NewTicker(3 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case now := <-ticker.C:
			store.mu.Lock()
			for _, srv := range store.servers {
				srv.LastSeen = now
				deltaCPU := (rand.Float64() - 0.5) * 4.0
				srv.CPU = math.Max(5.0, math.Min(98.0, srv.CPU+deltaCPU))

				deltaMem := (rand.Float64() - 0.5) * 1.5
				srv.Memory = math.Max(10.0, math.Min(95.0, srv.Memory+deltaMem))
			}
			store.mu.Unlock()

			if bus != nil {
				bus.Publish(realtime.Event{
					Type:      "dashboard.updated",
					Timestamp: now,
				})
			}
		}
	}
}

func RegisterDemoRoutes(r chi.Router, bus *realtime.Bus, hub *realtime.Hub, ticketStore *realtime.TicketStore) {
	initStore()

	// Public Auth routes
	r.Route("/auth", func(r chi.Router) {
		r.Post("/login", func(w http.ResponseWriter, r *http.Request) {
			var body struct {
				Email    string `json:"email"`
				Password string `json:"password"`
			}
			_ = json.NewDecoder(r.Body).Decode(&body)

			if body.Email == "" {
				body.Email = "admin@sentrix.local"
			}

			token, _, err := auth.GenerateAccessToken(uuid.New().String(), body.Email, "ADMIN")
			if err != nil {
				http.Error(w, "token error", http.StatusInternalServerError)
				return
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]any{
				"user": map[string]any{
					"id":    "usr-admin-demo",
					"email": body.Email,
					"role":  "ADMIN",
				},
				"access_token":  token,
				"refresh_token": "demo-refresh-token-" + uuid.New().String(),
				"expires_in":    900,
			})
		})

		r.Post("/refresh", func(w http.ResponseWriter, r *http.Request) {
			token, _, _ := auth.GenerateAccessToken(uuid.New().String(), "admin@sentrix.local", "ADMIN")
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]any{
				"access_token":  token,
				"refresh_token": "demo-refresh-token-" + uuid.New().String(),
				"expires_in":    900,
			})
		})

		r.Post("/logout", func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusNoContent)
		})

		r.Group(func(r chi.Router) {
			r.Use(auth.RequireAuth)
			r.Get("/me", auth.HandleMe())
		})
	})

	// Agent Endpoints
	r.Post("/agent/enroll", func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Hostname     string `json:"hostname"`
			Platform     string `json:"platform"`
			Architecture string `json:"architecture"`
			AgentVersion string `json:"agent_version"`
		}
		_ = json.NewDecoder(r.Body).Decode(&req)

		serverID := uuid.New().String()
		store.mu.Lock()
		store.servers[serverID] = &DemoServer{
			ID:       serverID,
			Name:     req.Hostname,
			Hostname: req.Hostname,
			Platform: req.Platform,
			Status:   "ONLINE",
			LastSeen: time.Now().UTC(),
			CPU:      15.0,
			Memory:   45.0,
			Disk:     30.0,
		}
		store.mu.Unlock()

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"agent_id":   uuid.New().String(),
			"credential": "demo-agent-credential",
			"server_url": "http://localhost:8080",
		})
	})

	r.Post("/agent/telemetry", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusAccepted)
		w.Write([]byte(`{"status":"accepted"}`))
	})

	// Authenticated Routes
	r.Group(func(r chi.Router) {
		r.Use(auth.RequireAuth)

		r.Get("/dashboard/summary", func(w http.ResponseWriter, r *http.Request) {
			store.mu.RLock()
			defer store.mu.RUnlock()

			total := len(store.servers)
			online := 0
			suspect := 0
			offline := 0

			for _, s := range store.servers {
				switch s.Status {
				case "ONLINE":
					online++
				case "SUSPECT":
					suspect++
				default:
					offline++
				}
			}

			openIncidents := 0
			criticalIncidents := 0
			for _, inc := range store.incidents {
				if inc.Status != "RESOLVED" {
					openIncidents++
					if inc.Severity == "CRITICAL" {
						criticalIncidents++
					}
				}
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]any{
				"servers": map[string]int{
					"total":   total,
					"online":  online,
					"suspect": suspect,
					"offline": offline,
				},
				"incidents": map[string]int{
					"open":     openIncidents,
					"critical": criticalIncidents,
				},
			})
		})

		r.Get("/servers", func(w http.ResponseWriter, r *http.Request) {
			store.mu.RLock()
			defer store.mu.RUnlock()

			list := make([]*DemoServer, 0, len(store.servers))
			for _, s := range store.servers {
				list = append(list, s)
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(list)
		})

		r.Get("/servers/{serverID}/metrics", func(w http.ResponseWriter, r *http.Request) {
			serverID := chi.URLParam(r, "serverID")
			metric := r.URL.Query().Get("metric")
			if metric == "" {
				metric = "cpu"
			}
			rangeParam := r.URL.Query().Get("range")
			if rangeParam == "" {
				rangeParam = "1h"
			}

			store.mu.RLock()
			srv, exists := store.servers[serverID]
			store.mu.RUnlock()

			if !exists {
				http.Error(w, "server not found", http.StatusNotFound)
				return
			}

			numPoints := 60
			stepMinutes := 1
			switch rangeParam {
			case "15m":
				numPoints = 15
				stepMinutes = 1
			case "1h":
				numPoints = 60
				stepMinutes = 1
			case "6h":
				numPoints = 72
				stepMinutes = 5
			case "24h":
				numPoints = 96
				stepMinutes = 15
			case "7d":
				numPoints = 84
				stepMinutes = 120
			}

			now := time.Now().UTC()
			points := make([]map[string]any, numPoints)
			baseVal := srv.CPU
			if metric == "memory" {
				baseVal = srv.Memory
			} else if metric == "disk" {
				baseVal = srv.Disk
			}

			for i := numPoints - 1; i >= 0; i-- {
				t := now.Add(-time.Duration(i*stepMinutes) * time.Minute)
				noise := math.Sin(float64(i)*0.2)*8.0 + (rand.Float64()-0.5)*4.0
				v := math.Max(2.0, math.Min(98.0, baseVal+noise))
				points[numPoints-1-i] = map[string]any{
					"time":  t.Format(time.RFC3339),
					"value": math.Round(v*10) / 10,
				}
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]any{
				"server_id": serverID,
				"metric":    metric,
				"range":     rangeParam,
				"unit":      "percent",
				"points":    points,
			})
		})

		r.Get("/incidents", func(w http.ResponseWriter, r *http.Request) {
			statusFilter := r.URL.Query().Get("status")
			store.mu.RLock()
			defer store.mu.RUnlock()

			list := make([]*DemoIncident, 0)
			for _, inc := range store.incidents {
				if statusFilter == "open" && inc.Status == "RESOLVED" {
					continue
				}
				list = append(list, inc)
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(list)
		})

		r.Patch("/incidents/{incidentID}/acknowledge", func(w http.ResponseWriter, r *http.Request) {
			id := chi.URLParam(r, "incidentID")
			store.mu.Lock()
			defer store.mu.Unlock()

			if inc, exists := store.incidents[id]; exists {
				now := time.Now().UTC()
				inc.Status = "ACKNOWLEDGED"
				inc.AcknowledgedAt = &now
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(inc)
				return
			}
			http.Error(w, "incident not found", http.StatusNotFound)
		})

		r.Patch("/incidents/{incidentID}/resolve", func(w http.ResponseWriter, r *http.Request) {
			id := chi.URLParam(r, "incidentID")
			store.mu.Lock()
			defer store.mu.Unlock()

			if inc, exists := store.incidents[id]; exists {
				now := time.Now().UTC()
				inc.Status = "RESOLVED"
				inc.ResolvedAt = &now
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(inc)
				return
			}
			http.Error(w, "incident not found", http.StatusNotFound)
		})

		r.Post("/incidents/{incidentID}/comments", func(w http.ResponseWriter, r *http.Request) {
			id := chi.URLParam(r, "incidentID")
			var body struct {
				Body string `json:"body"`
			}
			_ = json.NewDecoder(r.Body).Decode(&body)

			store.mu.Lock()
			defer store.mu.Unlock()

			if inc, exists := store.incidents[id]; exists {
				inc.Comments = append(inc.Comments, body.Body)
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(map[string]any{"status": "comment_added"})
				return
			}
			http.Error(w, "incident not found", http.StatusNotFound)
		})

		r.Get("/alerts/rules", func(w http.ResponseWriter, r *http.Request) {
			store.mu.RLock()
			defer store.mu.RUnlock()

			list := make([]*DemoAlertRule, 0, len(store.alertRules))
			for _, rule := range store.alertRules {
				list = append(list, rule)
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(list)
		})

		r.Post("/alerts/rules", func(w http.ResponseWriter, r *http.Request) {
			var rule DemoAlertRule
			_ = json.NewDecoder(r.Body).Decode(&rule)
			rule.ID = uuid.New().String()
			rule.CreatedAt = time.Now().UTC()
			rule.Enabled = true

			store.mu.Lock()
			store.alertRules[rule.ID] = &rule
			store.mu.Unlock()

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(rule)
		})

		r.Delete("/alerts/rules/{ruleID}", func(w http.ResponseWriter, r *http.Request) {
			id := chi.URLParam(r, "ruleID")
			store.mu.Lock()
			delete(store.alertRules, id)
			store.mu.Unlock()
			w.WriteHeader(http.StatusNoContent)
		})

		r.Get("/checks", func(w http.ResponseWriter, r *http.Request) {
			store.mu.RLock()
			defer store.mu.RUnlock()

			list := make([]*DemoCheck, 0, len(store.checks))
			for _, chk := range store.checks {
				list = append(list, chk)
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(list)
		})

		r.Post("/checks", func(w http.ResponseWriter, r *http.Request) {
			var chk DemoCheck
			_ = json.NewDecoder(r.Body).Decode(&chk)
			chk.ID = uuid.New().String()
			chk.CreatedAt = time.Now().UTC()
			chk.LastResultAt = time.Now().UTC()
			chk.State = "HEALTHY"

			store.mu.Lock()
			if srv, ok := store.servers[chk.ServerID]; ok {
				chk.ServerName = srv.Name
			}
			store.checks[chk.ID] = &chk
			store.mu.Unlock()

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(chk)
		})

		r.Delete("/checks/{checkID}", func(w http.ResponseWriter, r *http.Request) {
			id := chi.URLParam(r, "checkID")
			store.mu.Lock()
			delete(store.checks, id)
			store.mu.Unlock()
			w.WriteHeader(http.StatusNoContent)
		})

		r.Post("/realtime/ticket", func(w http.ResponseWriter, r *http.Request) {
			ticket := ticketStore.Issue("demo-admin-id")
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]any{
				"ticket":     ticket,
				"expires_in": 30,
			})
		})

		// Server management
		r.Delete("/servers/{serverID}", func(w http.ResponseWriter, r *http.Request) {
			id := chi.URLParam(r, "serverID")
			store.mu.Lock()
			delete(store.servers, id)
			store.mu.Unlock()
			w.WriteHeader(http.StatusNoContent)
		})

		// Users management
		r.Get("/users", func(w http.ResponseWriter, r *http.Request) {
			store.mu.RLock()
			defer store.mu.RUnlock()

			list := make([]*DemoUser, 0, len(store.users))
			for _, u := range store.users {
				list = append(list, u)
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(list)
		})

		r.Post("/users", func(w http.ResponseWriter, r *http.Request) {
			var body struct {
				Email    string `json:"email"`
				Password string `json:"password"`
				Role     string `json:"role"`
			}
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				http.Error(w, "invalid JSON", http.StatusBadRequest)
				return
			}
			if body.Role == "" {
				body.Role = "VIEWER"
			}

			user := &DemoUser{
				ID:        uuid.New().String(),
				Email:     body.Email,
				Role:      body.Role,
				Status:    "ACTIVE",
				CreatedAt: time.Now().UTC(),
			}

			store.mu.Lock()
			store.users[user.ID] = user
			store.mu.Unlock()

			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusCreated)
			json.NewEncoder(w).Encode(user)
		})

		r.Delete("/users/{userID}", func(w http.ResponseWriter, r *http.Request) {
			id := chi.URLParam(r, "userID")
			store.mu.Lock()
			delete(store.users, id)
			store.mu.Unlock()
			w.WriteHeader(http.StatusNoContent)
		})

		// Notifications channels management
		r.Get("/notifications/channels", func(w http.ResponseWriter, r *http.Request) {
			store.mu.RLock()
			defer store.mu.RUnlock()

			list := make([]*DemoChannel, 0, len(store.channels))
			for _, c := range store.channels {
				list = append(list, c)
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(list)
		})

		r.Post("/notifications/channels", func(w http.ResponseWriter, r *http.Request) {
			var body struct {
				Name   string         `json:"name"`
				Type   string         `json:"type"`
				Config map[string]any `json:"config"`
			}
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				http.Error(w, "invalid JSON", http.StatusBadRequest)
				return
			}

			channel := &DemoChannel{
				ID:        uuid.New().String(),
				Name:      body.Name,
				Type:      body.Type,
				Config:    body.Config,
				Enabled:   true,
				CreatedAt: time.Now().UTC(),
			}

			store.mu.Lock()
			store.channels[channel.ID] = channel
			store.mu.Unlock()

			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusCreated)
			json.NewEncoder(w).Encode(channel)
		})

		r.Delete("/notifications/channels/{channelID}", func(w http.ResponseWriter, r *http.Request) {
			id := chi.URLParam(r, "channelID")
			store.mu.Lock()
			delete(store.channels, id)
			store.mu.Unlock()
			w.WriteHeader(http.StatusNoContent)
		})

		r.Get("/notifications/jobs", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode([]map[string]any{})
		})

		// Agent enrollment token management
		r.Post("/agents/enrollment-tokens", func(w http.ResponseWriter, r *http.Request) {
			id := uuid.New().String()
			token := "enr_" + uuid.New().String()
			expiresAt := time.Now().UTC().Add(24 * time.Hour)

			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusCreated)
			json.NewEncoder(w).Encode(map[string]any{
				"id":         id,
				"token":      token,
				"expires_at": expiresAt,
			})
		})

		r.Get("/agents/enrollment-tokens", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode([]map[string]any{
				{
					"id":          "enr-demo-sample",
					"description": "Default Agent Token",
					"expires_at":  time.Now().Add(24 * time.Hour),
					"created_at":  time.Now(),
				},
			})
		})

		r.Post("/realtime/ticket", func(w http.ResponseWriter, r *http.Request) {
			ticket := ticketStore.Issue("demo-admin-id")
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]any{
				"ticket":     ticket,
				"expires_in": 30,
			})
		})

		r.Post("/auth/ws-ticket", func(w http.ResponseWriter, r *http.Request) {
			ticket := ticketStore.Issue("demo-admin-id")
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]any{
				"ticket":     ticket,
				"expires_in": 30,
			})
		})

		// Top host processes
		r.Get("/servers/{serverID}/processes", func(w http.ResponseWriter, r *http.Request) {
			serverID := chi.URLParam(r, "serverID")
			store.mu.RLock()
			srv, exists := store.servers[serverID]
			store.mu.RUnlock()

			if !exists {
				http.Error(w, "server not found", http.StatusNotFound)
				return
			}

			isDB := strings.Contains(srv.Name, "db") || strings.Contains(srv.Hostname, "db")
			isWorker := strings.Contains(srv.Name, "worker")
			now := time.Now()

			var procs []DemoProcess
			if isDB {
				procs = []DemoProcess{
					{PID: 1042, Name: "postgres: writer process", User: "postgres", CPU: math.Max(2.0, srv.CPU*0.35), MemoryRSS: "1.8 GB", State: "RUNNING"},
					{PID: 1045, Name: "postgres: walwriter", User: "postgres", CPU: math.Max(1.0, srv.CPU*0.18), MemoryRSS: "850 MB", State: "RUNNING"},
					{PID: 1048, Name: "postgres: autovacuum worker", User: "postgres", CPU: math.Max(0.5, srv.CPU*0.22), MemoryRSS: "640 MB", State: "SLEEPING"},
					{PID: 1120, Name: "sentrix-agent", User: "sentrix", CPU: 0.3, MemoryRSS: "14 MB", State: "RUNNING"},
					{PID: 512, Name: "systemd-journald", User: "root", CPU: 0.2, MemoryRSS: "32 MB", State: "SLEEPING"},
					{PID: 889, Name: "sshd: root@pts/0", User: "root", CPU: 0.1, MemoryRSS: "8 MB", State: "SLEEPING"},
					{PID: 1, Name: "systemd", User: "root", CPU: 0.0, MemoryRSS: "12 MB", State: "SLEEPING"},
				}
			} else if isWorker {
				procs = []DemoProcess{
					{PID: 2011, Name: "sentrix-worker: pool-runner", User: "app", CPU: math.Max(3.0, srv.CPU*0.55), MemoryRSS: "480 MB", State: "RUNNING"},
					{PID: 2015, Name: "redis-server 0.0.0.0:6379", User: "redis", CPU: math.Max(1.0, srv.CPU*0.25), MemoryRSS: "320 MB", State: "RUNNING"},
					{PID: 1120, Name: "sentrix-agent", User: "sentrix", CPU: 0.3, MemoryRSS: "14 MB", State: "RUNNING"},
					{PID: 512, Name: "systemd-journald", User: "root", CPU: 0.1, MemoryRSS: "28 MB", State: "SLEEPING"},
					{PID: 1, Name: "systemd", User: "root", CPU: 0.0, MemoryRSS: "10 MB", State: "SLEEPING"},
				}
			} else {
				procs = []DemoProcess{
					{PID: 1804, Name: "node /app/server.js", User: "node", CPU: math.Max(2.0, srv.CPU*0.45), MemoryRSS: "620 MB", State: "RUNNING"},
					{PID: 1805, Name: "nginx: worker process", User: "www-data", CPU: math.Max(1.0, srv.CPU*0.25), MemoryRSS: "110 MB", State: "RUNNING"},
					{PID: 1801, Name: "nginx: master process", User: "root", CPU: 0.2, MemoryRSS: "45 MB", State: "SLEEPING"},
					{PID: 1120, Name: "sentrix-agent", User: "sentrix", CPU: 0.3, MemoryRSS: "14 MB", State: "RUNNING"},
					{PID: 512, Name: "systemd-journald", User: "root", CPU: 0.1, MemoryRSS: "30 MB", State: "SLEEPING"},
					{PID: 1, Name: "systemd", User: "root", CPU: 0.0, MemoryRSS: "12 MB", State: "SLEEPING"},
				}
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]any{
				"server_id": serverID,
				"timestamp": now.Format(time.RFC3339),
				"count":     len(procs),
				"processes": procs,
			})
		})

		// Live server log streamer
		r.Get("/servers/{serverID}/logs", func(w http.ResponseWriter, r *http.Request) {
			serverID := chi.URLParam(r, "serverID")
			store.mu.RLock()
			srv, exists := store.servers[serverID]
			store.mu.RUnlock()

			if !exists {
				http.Error(w, "server not found", http.StatusNotFound)
				return
			}

			now := time.Now()
			logs := []DemoLogEntry{
				{Timestamp: now.Add(-55 * time.Second), Level: "INFO", Unit: "systemd", Message: "Starting SentriX Telemetry Collection Daemon..."},
				{Timestamp: now.Add(-54 * time.Second), Level: "INFO", Unit: "sentrix-agent", Message: "Collector initialized. Sampling Linux /proc metrics every 5000ms."},
				{Timestamp: now.Add(-42 * time.Second), Level: "INFO", Unit: "kernel", Message: "TCP established connection from 127.0.0.1:8080. Socket buffer queue OK."},
				{Timestamp: now.Add(-30 * time.Second), Level: "INFO", Unit: "sentrix-agent", Message: fmt.Sprintf("Reported telemetry sequence to ingest gateway. Host: %s, CPU: %.1f%%, Mem: %.1f%%", srv.Hostname, srv.CPU, srv.Memory)},
				{Timestamp: now.Add(-18 * time.Second), Level: "WARN", Unit: "systemd-journald", Message: "Suppressed 4 messages due to rate-limiting in journal."},
				{Timestamp: now.Add(-8 * time.Second), Level: "INFO", Unit: "sentrix-agent", Message: "Executed 4 synthetic checks: 4 passed, 0 failed. Latency: 1.8ms."},
				{Timestamp: now.Add(-2 * time.Second), Level: "INFO", Unit: "sentrix-agent", Message: "Telemetry payload acknowledged by SentriX server (HTTP 200 OK)."},
			}

			if srv.Status == "SUSPECT" {
				logs = append(logs, DemoLogEntry{
					Timestamp: now.Add(-1 * time.Second),
					Level:     "ERROR",
					Unit:      "kernel",
					Message:   "Out of memory risk: system memory utilization threshold exceeded 85% for > 5m!",
				})
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(logs)
		})

		// Silences / Maintenance Windows
		r.Get("/silences", func(w http.ResponseWriter, r *http.Request) {
			store.mu.RLock()
			defer store.mu.RUnlock()

			now := time.Now()
			list := make([]*DemoSilence, 0, len(store.silences))
			for _, s := range store.silences {
				s.Active = s.StartsAt.Before(now) && s.EndsAt.After(now)
				list = append(list, s)
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(list)
		})

		r.Post("/silences", func(w http.ResponseWriter, r *http.Request) {
			var body struct {
				ServerID        *string `json:"server_id"`
				RuleID          *string `json:"rule_id"`
				Reason          string  `json:"reason"`
				DurationMinutes int     `json:"duration_minutes"`
			}
			_ = json.NewDecoder(r.Body).Decode(&body)

			now := time.Now()
			duration := time.Duration(body.DurationMinutes) * time.Minute
			if duration <= 0 {
				duration = 60 * time.Minute
			}

			var srvName *string
			if body.ServerID != nil {
				store.mu.RLock()
				if srv, ok := store.servers[*body.ServerID]; ok {
					srvName = &srv.Name
				}
				store.mu.RUnlock()
			}

			silence := &DemoSilence{
				ID:         "sil-" + uuid.New().String()[:8],
				ServerID:   body.ServerID,
				ServerName: srvName,
				RuleID:     body.RuleID,
				Reason:     body.Reason,
				StartsAt:   now,
				EndsAt:     now.Add(duration),
				CreatedAt:  now,
				Active:     true,
			}
			if silence.Reason == "" {
				silence.Reason = "Scheduled maintenance window"
			}

			store.mu.Lock()
			store.silences[silence.ID] = silence
			store.mu.Unlock()

			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusCreated)
			json.NewEncoder(w).Encode(silence)
		})

		r.Delete("/silences/{silenceID}", func(w http.ResponseWriter, r *http.Request) {
			id := chi.URLParam(r, "silenceID")
			store.mu.Lock()
			delete(store.silences, id)
			store.mu.Unlock()
			w.WriteHeader(http.StatusNoContent)
		})

		// Audit Logs
		r.Get("/audit-logs", func(w http.ResponseWriter, r *http.Request) {
			store.mu.RLock()
			defer store.mu.RUnlock()

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(store.auditLogs)
		})
	})

	// WebSocket handler
	r.Get("/ws", realtime.HandleWebSocket(hub, ticketStore))
}

func init() {
	_ = strconv.Itoa(0)
	_ = fmt.Sprintf("")
}
