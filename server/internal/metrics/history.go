package metrics

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type MetricPoint struct {
	Time  time.Time `json:"time"`
	Value float64   `json:"value"`
}

type MetricHistoryResponse struct {
	ServerID string        `json:"server_id"`
	Metric   string        `json:"metric"`
	Range    string        `json:"range"`
	Unit     string        `json:"unit"`
	Points   []MetricPoint `json:"points"`
}

var metricTables = map[string]string{
	"cpu":    "metric_cpu",
	"memory": "metric_memory",
	"disk":   "metric_disk",
}

var rangeIntervals = map[string]string{
	"15m": "15 minutes",
	"1h":  "1 hour",
	"6h":  "6 hours",
	"24h": "24 hours",
	"7d":  "7 days",
}

var stepIntervals = map[string]string{
	"15m": "1 minute",
	"1h":  "5 minutes",
	"6h":  "15 minutes",
	"24h": "1 hour",
	"7d":  "6 hours",
}

// GET /api/v1/servers/{serverID}/metrics?metric=cpu&range=1h
func HandleServerMetrics(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		serverID := chi.URLParam(r, "serverID")

		metric := r.URL.Query().Get("metric")
		if metric == "" {
			metric = "cpu"
		}

		timeRange := r.URL.Query().Get("range")
		if timeRange == "" {
			timeRange = "1h"
		}

		table, ok := metricTables[metric]
		if !ok {
			http.Error(w, "unsupported metric", http.StatusBadRequest)
			return
		}

		interval, ok := rangeIntervals[timeRange]
		if !ok {
			http.Error(w, "unsupported range", http.StatusBadRequest)
			return
		}

		step, ok := stepIntervals[timeRange]
		if !ok {
			http.Error(w, "unsupported step", http.StatusBadRequest)
			return
		}

		query := fmt.Sprintf(`
			SELECT
				time_bucket($3::interval, time) AS bucket,
				AVG(value) AS value
			FROM %s
			WHERE server_id = $1
			  AND time > now() - $2::interval
			GROUP BY bucket
			ORDER BY bucket ASC
		`, table)

		rows, err := pool.Query(r.Context(), query, serverID, interval, step)
		if err != nil {
			http.Error(w, "database query failed", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		points := []MetricPoint{}

		for rows.Next() {
			var point MetricPoint
			if err := rows.Scan(&point.Time, &point.Value); err != nil {
				http.Error(w, "scan failed", http.StatusInternalServerError)
				return
			}
			points = append(points, point)
		}

		resp := MetricHistoryResponse{
			ServerID: serverID,
			Metric:   metric,
			Range:    timeRange,
			Unit:     "percent",
			Points:   points,
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}
}
