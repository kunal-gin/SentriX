package selfmetrics

import (
	"encoding/json"
	"net/http"
	"runtime"
	"sync/atomic"
	"time"
)

type Registry struct {
	startedAt time.Time

	IngestRequests       atomic.Int64
	IngestFailures       atomic.Int64
	IngestSamples        atomic.Int64
	AlertEvaluations     atomic.Int64
	AlertsFired          atomic.Int64
	NotificationFailures atomic.Int64
	WebSocketConnections atomic.Int64
}

var global = &Registry{
	startedAt: time.Now(),
}

func Global() *Registry {
	return global
}

func HandleMetrics() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		g := Global()

		response := map[string]any{
			"uptime_seconds":                 time.Since(g.startedAt).Seconds(),
			"goroutines":                     runtime.NumGoroutine(),
			"ingest_requests_total":          g.IngestRequests.Load(),
			"ingest_failures_total":          g.IngestFailures.Load(),
			"ingest_samples_total":           g.IngestSamples.Load(),
			"alert_evaluations_total":        g.AlertEvaluations.Load(),
			"alerts_fired_total":             g.AlertsFired.Load(),
			"notification_failures_total":    g.NotificationFailures.Load(),
			"websocket_connections_current":  g.WebSocketConnections.Load(),
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
	}
}
