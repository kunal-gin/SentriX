package health

import (
	"encoding/json"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
)

type DashboardSummary struct {
	Servers   ServerCounts   `json:"servers"`
	Incidents IncidentCounts `json:"incidents"`
}

type ServerCounts struct {
	Total    int `json:"total"`
	Online   int `json:"online"`
	Suspect  int `json:"suspect"`
	Offline  int `json:"offline"`
}

type IncidentCounts struct {
	Open     int `json:"open"`
	Critical int `json:"critical"`
}

// GET /api/v1/dashboard/summary
func HandleDashboardSummary(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		var summary DashboardSummary

		// 1. Get Server Counts (Computing status dynamically based on last_seen_at)
		err := pool.QueryRow(ctx, `
			SELECT 
				COUNT(*) as total,
				COUNT(*) FILTER (WHERE last_seen_at > NOW() - INTERVAL '30 seconds') as online,
				COUNT(*) FILTER (WHERE last_seen_at <= NOW() - INTERVAL '30 seconds' AND last_seen_at > NOW() - INTERVAL '60 seconds') as suspect,
				COUNT(*) FILTER (WHERE last_seen_at <= NOW() - INTERVAL '60 seconds') as offline
			FROM servers
		`).Scan(&summary.Servers.Total, &summary.Servers.Online, &summary.Servers.Suspect, &summary.Servers.Offline)
		
		if err != nil {
			http.Error(w, "Database error", http.StatusInternalServerError)
			return
		}

		// 2. Get Incident Counts
		err = pool.QueryRow(ctx, `
			SELECT 
				COUNT(*) FILTER (WHERE status = 'OPEN' OR status = 'ACKNOWLEDGED') as open,
				COUNT(*) FILTER (WHERE severity = 'CRITICAL' AND (status = 'OPEN' OR status = 'ACKNOWLEDGED')) as critical
			FROM incidents
		`).Scan(&summary.Incidents.Open, &summary.Incidents.Critical)

		if err != nil {
			http.Error(w, "Database error", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(summary)
	}
}
