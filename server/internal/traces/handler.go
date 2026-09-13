package traces

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/sentrix/server/internal/api"
)

type SpanEvent struct {
	Name       string         `json:"name"`
	Timestamp  time.Time      `json:"timestamp"`
	Attributes map[string]any `json:"attributes,omitempty"`
}

type Span struct {
	SpanID       string         `json:"span_id"`
	ParentSpanID *string        `json:"parent_span_id,omitempty"`
	TraceID      string         `json:"trace_id"`
	ServiceName  string         `json:"service_name"`
	Operation    string         `json:"operation"`
	DurationMs   float64        `json:"duration_ms"`
	StartTime    time.Time      `json:"start_time"`
	Status       string         `json:"status"` // OK, ERROR
	StatusCode   int            `json:"status_code,omitempty"`
	Attributes   map[string]any `json:"attributes,omitempty"`
	Events       []SpanEvent    `json:"events,omitempty"`
}

type TraceDetail struct {
	TraceID       string    `json:"trace_id"`
	RootService   string    `json:"root_service"`
	RootOperation string    `json:"root_operation"`
	DurationMs    float64   `json:"duration_ms"`
	StartTime     time.Time `json:"start_time"`
	Status        string    `json:"status"`
	SpanCount     int       `json:"span_count"`
	Spans         []Span    `json:"spans"`
}

var (
	traceStoreMu sync.RWMutex
	traceBuffer  []TraceDetail
)

func init() {
	now := time.Now().UTC()

	// Trace 1: Checkout API with Database connection pool error
	rootSpanID1 := "spn_root_001"
	childSpan1_1 := "spn_checkout_001"
	childSpan1_2 := "spn_db_pool_001"
	childSpan1_3 := "spn_redis_001"

	t1 := TraceDetail{
		TraceID:       "trc_9a8b7c6d5e4f",
		RootService:   "edge-ingress",
		RootOperation: "POST /v1/checkout/charge",
		DurationMs:    128.4,
		StartTime:     now.Add(-6 * time.Minute),
		Status:        "ERROR",
		SpanCount:     4,
		Spans: []Span{
			{
				SpanID:      rootSpanID1,
				TraceID:     "trc_9a8b7c6d5e4f",
				ServiceName: "edge-ingress",
				Operation:   "POST /v1/checkout/charge",
				DurationMs:  128.4,
				StartTime:   now.Add(-6 * time.Minute),
				Status:      "ERROR",
				StatusCode:  503,
				Attributes: map[string]any{
					"http.method":      "POST",
					"http.route":       "/v1/checkout/charge",
					"http.status_code": 503,
					"client.ip":        "203.0.113.88",
					"user_agent":       "Mozilla/5.0 (Macintosh)",
				},
			},
			{
				SpanID:       childSpan1_1,
				ParentSpanID: &rootSpanID1,
				TraceID:      "trc_9a8b7c6d5e4f",
				ServiceName:  "payments-service",
				Operation:    "AuthorizePaymentGateway",
				DurationMs:   112.1,
				StartTime:    now.Add(-6*time.Minute + 5*time.Millisecond),
				Status:       "ERROR",
				StatusCode:   503,
				Attributes: map[string]any{
					"rpc.system": "grpc",
					"payment.currency": "USD",
					"payment.amount": 149.00,
				},
			},
			{
				SpanID:       childSpan1_2,
				ParentSpanID: &childSpan1_1,
				TraceID:      "trc_9a8b7c6d5e4f",
				ServiceName:  "timescale-db-cluster-01",
				Operation:    "SELECT acquire_db_connection_pool",
				DurationMs:   94.6,
				StartTime:    now.Add(-6*time.Minute + 12*time.Millisecond),
				Status:       "ERROR",
				StatusCode:   500,
				Attributes: map[string]any{
					"db.system":    "postgresql",
					"db.name":      "sentrix_telemetry",
					"error.reason": "connection buffer limit saturated (96%)",
				},
			},
			{
				SpanID:       childSpan1_3,
				ParentSpanID: &childSpan1_1,
				TraceID:      "trc_9a8b7c6d5e4f",
				ServiceName:  "cache-redis",
				Operation:    "GET idempotency_key",
				DurationMs:   3.8,
				StartTime:    now.Add(-6*time.Minute + 7*time.Millisecond),
				Status:       "OK",
				StatusCode:   200,
				Attributes: map[string]any{
					"db.system": "redis",
					"cache.hit": true,
				},
			},
		},
	}

	// Trace 2: Auth OIDC Token Validation (Healthy)
	rootSpanID2 := "spn_root_002"
	childSpan2_1 := "spn_auth_001"
	childSpan2_2 := "spn_db_user_001"

	t2 := TraceDetail{
		TraceID:       "trc_1e2d3c4b5a6f",
		RootService:   "edge-ingress",
		RootOperation: "POST /api/v1/auth/token",
		DurationMs:    44.2,
		StartTime:     now.Add(-12 * time.Minute),
		Status:        "OK",
		SpanCount:     3,
		Spans: []Span{
			{
				SpanID:      rootSpanID2,
				TraceID:     "trc_1e2d3c4b5a6f",
				ServiceName: "edge-ingress",
				Operation:   "POST /api/v1/auth/token",
				DurationMs:  44.2,
				StartTime:   now.Add(-12 * time.Minute),
				Status:      "OK",
				StatusCode:  200,
				Attributes: map[string]any{
					"http.status_code": 200,
					"auth.grant_type":  "authorization_code",
				},
			},
			{
				SpanID:       childSpan2_1,
				ParentSpanID: &rootSpanID2,
				TraceID:      "trc_1e2d3c4b5a6f",
				ServiceName:  "auth-gateway",
				Operation:    "ValidateSessionTokens",
				DurationMs:   36.5,
				StartTime:    now.Add(-12*time.Minute + 3*time.Millisecond),
				Status:      "OK",
				StatusCode:  200,
			},
			{
				SpanID:       childSpan2_2,
				ParentSpanID: &childSpan2_1,
				TraceID:      "trc_1e2d3c4b5a6f",
				ServiceName:  "timescale-db-cluster-01",
				Operation:    "SELECT users WHERE email = $1",
				DurationMs:   14.2,
				StartTime:    now.Add(-12*time.Minute + 8*time.Millisecond),
				Status:      "OK",
				StatusCode:  200,
			},
		},
	}

	// Trace 3: Telemetry Batch Rollup (Healthy)
	rootSpanID3 := "spn_root_003"
	childSpan3_1 := "spn_downsample_001"
	t3 := TraceDetail{
		TraceID:       "trc_5b4c3d2e1a90",
		RootService:   "worker-runner",
		RootOperation: "Job::DownsampleMetricsRollup",
		DurationMs:    184.0,
		StartTime:     now.Add(-18 * time.Minute),
		Status:        "OK",
		SpanCount:     2,
		Spans: []Span{
			{
				SpanID:      rootSpanID3,
				TraceID:     "trc_5b4c3d2e1a90",
				ServiceName: "worker-runner",
				Operation:   "Job::DownsampleMetricsRollup",
				DurationMs:  184.0,
				StartTime:   now.Add(-18 * time.Minute),
				Status:      "OK",
				Attributes: map[string]any{
					"batch.records": 14200,
					"job.interval":  "5m",
				},
			},
			{
				SpanID:       childSpan3_1,
				ParentSpanID: &rootSpanID3,
				TraceID:      "trc_5b4c3d2e1a90",
				ServiceName:  "telemetry-engine",
				Operation:    "TimescaleDB::ChunkDownsample",
				DurationMs:   148.2,
				StartTime:    now.Add(-18*time.Minute + 12*time.Millisecond),
				Status:      "OK",
			},
		},
	}

	traceBuffer = []TraceDetail{t1, t2, t3}
}

// GET /api/v1/traces
func HandleListTraces(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		service := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("service")))
		operation := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("operation")))
		status := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("status")))
		minDuration := r.URL.Query().Get("min_duration_ms")

		var minDur float64
		if minDuration != "" {
			if parsed, err := strconv.ParseFloat(minDuration, 64); err == nil {
				minDur = parsed
			}
		}

		traceStoreMu.RLock()
		defer traceStoreMu.RUnlock()

		filtered := make([]TraceDetail, 0)
		for _, item := range traceBuffer {
			if status != "" && status != "ALL" && item.Status != status {
				continue
			}
			if service != "" && !strings.Contains(strings.ToLower(item.RootService), service) {
				continue
			}
			if operation != "" && !strings.Contains(strings.ToLower(item.RootOperation), operation) {
				continue
			}
			if minDur > 0 && item.DurationMs < minDur {
				continue
			}
			filtered = append(filtered, item)
		}

		api.RespondJSON(w, http.StatusOK, filtered)
	}
}

// GET /api/v1/traces/{traceID}
func HandleGetTrace(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		traceID := chi.URLParam(r, "traceID")

		traceStoreMu.RLock()
		defer traceStoreMu.RUnlock()

		for _, item := range traceBuffer {
			if item.TraceID == traceID {
				api.RespondJSON(w, http.StatusOK, item)
				return
			}
		}

		api.RespondError(w, r, http.StatusNotFound, "NOT_FOUND", "Trace ID not found")
	}
}

// POST /api/v1/traces & POST /otlp/v1/traces
func HandleIngestTraces(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req TraceDetail
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			api.RespondError(w, r, http.StatusBadRequest, "INVALID_PAYLOAD", "Invalid trace payload")
			return
		}

		if req.TraceID == "" {
			req.TraceID = "trc_" + uuid.New().String()[:12]
		}
		if req.StartTime.IsZero() {
			req.StartTime = time.Now().UTC()
		}
		if req.SpanCount == 0 {
			req.SpanCount = len(req.Spans)
		}

		traceStoreMu.Lock()
		traceBuffer = append([]TraceDetail{req}, traceBuffer...)
		if len(traceBuffer) > 500 {
			traceBuffer = traceBuffer[:500]
		}
		traceStoreMu.Unlock()

		api.RespondJSON(w, http.StatusAccepted, map[string]string{
			"status":   "accepted",
			"trace_id": req.TraceID,
		})
	}
}
