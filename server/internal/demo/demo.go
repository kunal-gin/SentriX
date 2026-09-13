package demo

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"math/rand"
	"net/http"
	"strconv"
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

type DemoStore struct {
	mu         sync.RWMutex
	servers    map[string]*DemoServer
	incidents  map[string]*DemoIncident
	alertRules map[string]*DemoAlertRule
	checks     map[string]*DemoCheck
	users      map[string]*DemoUser
	channels   map[string]*DemoChannel
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
	})

	// WebSocket handler
	r.Get("/ws", realtime.HandleWebSocket(hub, ticketStore))
}

func init() {
	_ = strconv.Itoa(0)
	_ = fmt.Sprintf("")
}
