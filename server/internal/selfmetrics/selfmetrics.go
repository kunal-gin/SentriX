package selfmetrics

import (
	"encoding/json"
	"fmt"
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
			"uptime_seconds":                time.Since(g.startedAt).Seconds(),
			"goroutines":                    runtime.NumGoroutine(),
			"ingest_requests_total":         g.IngestRequests.Load(),
			"ingest_failures_total":         g.IngestFailures.Load(),
			"ingest_samples_total":          g.IngestSamples.Load(),
			"alert_evaluations_total":       g.AlertEvaluations.Load(),
			"alerts_fired_total":            g.AlertsFired.Load(),
			"notification_failures_total":   g.NotificationFailures.Load(),
			"websocket_connections_current": g.WebSocketConnections.Load(),
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
	}
}

// HandlePrometheusMetrics provides standard Prometheus text exposition format (version 0.0.4)
func HandlePrometheusMetrics() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		g := Global()
		var memStats runtime.MemStats
		runtime.ReadMemStats(&memStats)

		w.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")

		fmt.Fprintf(w, "# HELP sentrix_uptime_seconds Process uptime in seconds\n")
		fmt.Fprintf(w, "# TYPE sentrix_uptime_seconds gauge\n")
		fmt.Fprintf(w, "sentrix_uptime_seconds %.2f\n\n", time.Since(g.startedAt).Seconds())

		fmt.Fprintf(w, "# HELP sentrix_goroutines Number of running goroutines\n")
		fmt.Fprintf(w, "# TYPE sentrix_goroutines gauge\n")
		fmt.Fprintf(w, "sentrix_goroutines %d\n\n", runtime.NumGoroutine())

		fmt.Fprintf(w, "# HELP sentrix_mem_alloc_bytes Bytes allocated and not yet freed\n")
		fmt.Fprintf(w, "# TYPE sentrix_mem_alloc_bytes gauge\n")
		fmt.Fprintf(w, "sentrix_mem_alloc_bytes %d\n\n", memStats.Alloc)

		fmt.Fprintf(w, "# HELP sentrix_ingest_requests_total Total number of metric ingest requests\n")
		fmt.Fprintf(w, "# TYPE sentrix_ingest_requests_total counter\n")
		fmt.Fprintf(w, "sentrix_ingest_requests_total %d\n\n", g.IngestRequests.Load())

		fmt.Fprintf(w, "# HELP sentrix_ingest_failures_total Total number of failed metric ingests\n")
		fmt.Fprintf(w, "# TYPE sentrix_ingest_failures_total counter\n")
		fmt.Fprintf(w, "sentrix_ingest_failures_total %d\n\n", g.IngestFailures.Load())

		fmt.Fprintf(w, "# HELP sentrix_ingest_samples_total Total number of telemetry metric data points ingested\n")
		fmt.Fprintf(w, "# TYPE sentrix_ingest_samples_total counter\n")
		fmt.Fprintf(w, "sentrix_ingest_samples_total %d\n\n", g.IngestSamples.Load())

		fmt.Fprintf(w, "# HELP sentrix_alert_evaluations_total Total number of alert rule evaluations\n")
		fmt.Fprintf(w, "# TYPE sentrix_alert_evaluations_total counter\n")
		fmt.Fprintf(w, "sentrix_alert_evaluations_total %d\n\n", g.AlertEvaluations.Load())

		fmt.Fprintf(w, "# HELP sentrix_alerts_fired_total Total number of incidents triggered\n")
		fmt.Fprintf(w, "# TYPE sentrix_alerts_fired_total counter\n")
		fmt.Fprintf(w, "sentrix_alerts_fired_total %d\n\n", g.AlertsFired.Load())

		fmt.Fprintf(w, "# HELP sentrix_notification_failures_total Total failed webhook deliveries\n")
		fmt.Fprintf(w, "# TYPE sentrix_notification_failures_total counter\n")
		fmt.Fprintf(w, "sentrix_notification_failures_total %d\n\n", g.NotificationFailures.Load())

		fmt.Fprintf(w, "# HELP sentrix_websocket_connections Current active WebSocket client connections\n")
		fmt.Fprintf(w, "# TYPE sentrix_websocket_connections gauge\n")
		fmt.Fprintf(w, "sentrix_websocket_connections %d\n", g.WebSocketConnections.Load())
	}
}
