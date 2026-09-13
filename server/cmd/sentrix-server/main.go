package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/sentrix/server/internal/agents"
	"github.com/sentrix/server/internal/alerts"
	"github.com/sentrix/server/internal/auth"
	"github.com/sentrix/server/internal/checks"
	"github.com/sentrix/server/internal/demo"
	"github.com/sentrix/server/internal/health"
	"github.com/sentrix/server/internal/incidents"
	"github.com/sentrix/server/internal/metrics"
	"github.com/sentrix/server/internal/notifications"
	"github.com/sentrix/server/internal/realtime"
	"github.com/sentrix/server/internal/servers"
	"github.com/sentrix/server/internal/storage"
)

func main() {
	slog.Info("Starting SentriX Server...")

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	// Setup Event Bus, WebSocket Hub, and Realtime Ticket Store
	bus := realtime.NewBus()
	realtime.SetDefaultBus(bus)
	hub := realtime.NewHub(bus)
	go hub.Run()
	ticketStore := realtime.NewTicketStore()

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://sentrix:sentrix_secret@localhost:5432/sentrix?sslmode=disable"
	}

	var pool *pgxpool.Pool
	isDBLive := false

	poolConfig, err := pgxpool.ParseConfig(dbURL)
	if err == nil {
		poolConfig.ConnConfig.ConnectTimeout = 2 * time.Second
		p, err := pgxpool.NewWithConfig(ctx, poolConfig)
		if err == nil {
			pingCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
			if pingErr := p.Ping(pingCtx); pingErr == nil {
				pool = p
				isDBLive = true
				slog.Info("Connected to TimescaleDB successfully")

				migrationsDir := os.Getenv("SENTRIX_MIGRATIONS_DIR")
				if migrationsDir == "" {
					for _, dir := range []string{"migrations", "server/migrations", "../server/migrations"} {
						if _, err := os.Stat(dir); err == nil {
							migrationsDir = dir
							break
						}
					}
				}

				if migrationsDir != "" {
					if err := storage.ApplyMigrations(ctx, pool, migrationsDir); err != nil {
						slog.Warn("Failed to run schema migrations", "error", err)
					}
				}

				if err := auth.BootstrapAdmin(ctx, pool); err != nil {
					slog.Warn("Failed to bootstrap admin user", "error", err)
				}
			} else {
				p.Close()
			}
			cancel()
		}
	}

	if pool != nil {
		defer pool.Close()
	}

	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(corsMiddleware)

	r.Get("/health/live", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"live"}`))
	})

	r.Get("/health/ready", func(w http.ResponseWriter, r *http.Request) {
		if isDBLive {
			if err := pool.Ping(ctx); err != nil {
				w.WriteHeader(http.StatusServiceUnavailable)
				w.Write([]byte(`{"status":"not ready"}`))
				return
			}
		}
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ready"}`))
	})

	if isDBLive {
		slog.Info("Mounting persistent database endpoints")

		r.Route("/api/v1", func(r chi.Router) {
			// Public auth routes
			r.Route("/auth", func(r chi.Router) {
				r.Post("/login", auth.HandleLogin(pool))
				r.Post("/refresh", auth.HandleRefresh(pool))
				r.Post("/logout", auth.HandleLogout(pool))

				r.Group(func(r chi.Router) {
					r.Use(auth.RequireAuth)
					r.Get("/me", auth.HandleMe())
				})
			})

			// Agent endpoints
			r.Post("/agent/enroll", agents.HandleEnroll(pool))

			r.Group(func(r chi.Router) {
				r.Use(metrics.AgentAuthMiddleware(pool))
				r.Post("/agent/telemetry", metrics.HandleTelemetry(pool))
			})

			// Authenticated user routes
			r.Group(func(r chi.Router) {
				r.Use(auth.RequireAuth)

				// Read-only monitoring endpoints
				r.Get("/dashboard/summary", health.HandleDashboardSummary(pool))
				r.Get("/servers", servers.HandleListServers(pool))
				r.Get("/servers/{serverID}/metrics", metrics.HandleServerMetrics(pool))
				r.Get("/incidents", incidents.HandleListIncidents(pool))
				r.Get("/alerts/rules", alerts.HandleListRules(pool))
				r.Get("/checks", checks.HandleListChecks(pool))
				r.Get("/notifications/channels", notifications.HandleListChannels(pool))

				// Incident lifecycle actions
				r.Get("/incidents/{incidentID}", incidents.HandleGetIncident(pool))
				r.Patch("/incidents/{incidentID}/acknowledge", incidents.HandleAcknowledge(pool))
				r.Patch("/incidents/{incidentID}/resolve", incidents.HandleResolve(pool))
				r.Post("/incidents/{incidentID}/comments", incidents.HandleAddComment(pool))

				// Checks management
				r.Post("/checks", checks.HandleCreateCheck(pool))
				r.Patch("/checks/{checkID}", checks.HandleUpdateCheck(pool))
				r.Delete("/checks/{checkID}", checks.HandleDeleteCheck(pool))

				// Realtime ticket
				r.Post("/realtime/ticket", realtime.HandleIssueTicket(ticketStore))
				r.Post("/auth/ws-ticket", realtime.HandleIssueTicket(ticketStore))

				// Operator + Admin: alert & node management
				r.Group(func(r chi.Router) {
					r.Use(auth.RequireRole("ADMIN", "OPERATOR"))

					r.Delete("/servers/{serverID}", servers.HandleDeleteServer(pool))
					r.Post("/alerts/rules", alerts.HandleCreateRule(pool))
					r.Patch("/alerts/rules/{ruleID}", alerts.HandleUpdateRule(pool))
					r.Delete("/alerts/rules/{ruleID}", alerts.HandleDeleteRule(pool))
				})

				// Admin only
				r.Group(func(r chi.Router) {
					r.Use(auth.RequireRole("ADMIN"))

					r.Get("/users", auth.HandleListUsers(pool))
					r.Post("/users", auth.HandleCreateUser(pool))

					r.Post("/agents/enrollment-tokens", agents.HandleCreateEnrollmentToken(pool))
					r.Get("/agents/enrollment-tokens", agents.HandleListEnrollmentTokens(pool))

					r.Post("/notifications/channels", notifications.HandleCreateChannel(pool))
					r.Delete("/notifications/channels/{channelID}", notifications.HandleDeleteChannel(pool))

					r.Get("/notifications/jobs", notifications.HandleListJobs(pool))
				})
			})

			// WebSocket endpoint
			r.Get("/ws", realtime.HandleWebSocket(hub, ticketStore))
		})

		// Background workers
		go alerts.StartEngine(ctx, pool)
		go notifications.StartWorker(ctx, pool)
	} else {
		slog.Warn("TimescaleDB not reachable at localhost:5432; running in Standalone Demo Mode with live simulation!")
		slog.Info("Default credentials: admin@sentrix.local / admin12345")

		r.Route("/api/v1", func(apiRouter chi.Router) {
			demo.RegisterDemoRoutes(apiRouter, bus, hub, ticketStore)
		})

		go demo.StartSimulator(ctx, bus)
	}

	// Serve built web frontend (SPA fallback)
	webDir := os.Getenv("SENTRIX_WEB_DIR")
	if webDir == "" {
		for _, dir := range []string{"../web/dist", "web/dist", "../../web/dist"} {
			if _, err := os.Stat(filepath.Join(dir, "index.html")); err == nil {
				webDir = dir
				break
			}
		}
	}

	if webDir != "" {
		slog.Info("Serving web dashboard frontend", "directory", webDir)
		fileServer := http.FileServer(http.Dir(webDir))
		r.Get("/*", func(w http.ResponseWriter, r *http.Request) {
			path := filepath.Join(webDir, r.URL.Path)
			if info, err := os.Stat(path); os.IsNotExist(err) || info.IsDir() {
				http.ServeFile(w, r, filepath.Join(webDir, "index.html"))
				return
			}
			fileServer.ServeHTTP(w, r)
		})
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	srv := &http.Server{
		Addr:    ":" + port,
		Handler: r,
	}

	go func() {
		slog.Info("SentriX Server listening", "url", "http://localhost:"+port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("Server failed", "error", err)
			stop()
		}
	}()

	<-ctx.Done()
	slog.Info("Shutting down server...")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		slog.Error("Server forced shutdown", "error", err)
	}

	slog.Info("Server exited cleanly")
}

// Development-only CORS middleware.
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}
