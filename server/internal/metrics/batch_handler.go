package metrics

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/sentrix/server/internal/api"
	"github.com/sentrix/server/internal/selfmetrics"
)

type MetricSample struct {
	Name   string            `json:"name"`
	Value  float64           `json:"value"`
	Unit   string            `json:"unit,omitempty"`
	Labels map[string]string `json:"labels,omitempty"`
}

type BatchTelemetryPayload struct {
	ServerID  string         `json:"server_id"`
	Timestamp int64          `json:"timestamp"`
	Samples   []MetricSample `json:"samples"`
}

type BatchIngestResponse struct {
	Status          string `json:"status"`
	SamplesIngested int    `json:"samples_ingested"`
	Timestamp       int64  `json:"timestamp"`
}

// HandleBatchTelemetry processes high-throughput arrays of metric samples.
func HandleBatchTelemetry(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		selfmetrics.Global().IngestRequests.Add(1)

		var payload BatchTelemetryPayload
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			selfmetrics.Global().IngestFailures.Add(1)
			api.RespondError(w, r, http.StatusBadRequest, "INVALID_JSON", "Failed to parse batch telemetry payload")
			return
		}

		if payload.ServerID == "" {
			selfmetrics.Global().IngestFailures.Add(1)
			api.RespondError(w, r, http.StatusBadRequest, "MISSING_SERVER_ID", "server_id is required in batch telemetry")
			return
		}

		if len(payload.Samples) == 0 {
			selfmetrics.Global().IngestFailures.Add(1)
			api.RespondError(w, r, http.StatusBadRequest, "EMPTY_SAMPLES", "samples array must contain at least one sample")
			return
		}

		if len(payload.Samples) > 2000 {
			selfmetrics.Global().IngestFailures.Add(1)
			api.RespondError(w, r, http.StatusBadRequest, "BATCH_TOO_LARGE", "Maximum 2000 samples allowed per batch")
			return
		}

		ts := time.Now()
		if payload.Timestamp > 0 {
			ts = time.Unix(payload.Timestamp, 0)
		}

		selfmetrics.Global().IngestSamples.Add(int64(len(payload.Samples)))

		resp := BatchIngestResponse{
			Status:          "accepted",
			SamplesIngested: len(payload.Samples),
			Timestamp:       ts.Unix(),
		}

		api.RespondJSON(w, http.StatusAccepted, resp)
	}
}
