package servicemap

import (
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/sentrix/server/internal/api"
)

type MapNode struct {
	ID        string  `json:"id"`
	Label     string  `json:"label"`
	Type      string  `json:"type"`   // INGRESS, SERVICE, DATABASE, CACHE
	Health    string  `json:"health"` // HEALTHY, DEGRADED, FAILING
	RPS       float64 `json:"rps"`
	LatencyMs float64 `json:"latency_ms"`
	ErrorPct  float64 `json:"error_pct"`
}

type MapEdge struct {
	Source    string  `json:"source"`
	Target    string  `json:"target"`
	CallRate  float64 `json:"call_rate_rps"`
	LatencyMs float64 `json:"latency_ms"`
	Status    string  `json:"status"` // OK, SLOW, ERROR
}

type ServiceMapData struct {
	Nodes []MapNode `json:"nodes"`
	Edges []MapEdge `json:"edges"`
}

type SyntheticCheckResult struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	TargetURL    string    `json:"target_url"`
	Type         string    `json:"type"` // HTTP, TCP, DNS, TLS
	IntervalSec  int       `json:"interval_sec"`
	Status       string    `json:"status"` // PASSING, FAILING
	LatencyMs    float64   `json:"latency_ms"`
	DNSMs        float64   `json:"dns_ms"`
	TLSMs        float64   `json:"tls_ms"`
	TTFBMs       float64   `json:"ttfb_ms"`
	Availability float64   `json:"availability"`
	LastCheckAt  time.Time `json:"last_check_at"`
}

var defaultServiceMap = ServiceMapData{
	Nodes: []MapNode{
		{
			ID:        "edge-ingress",
			Label:     "Edge Ingress Proxy",
			Type:      "INGRESS",
			Health:    "HEALTHY",
			RPS:       1420.5,
			LatencyMs: 8.2,
			ErrorPct:  0.02,
		},
		{
			ID:        "auth-gateway",
			Label:     "Auth & IAM Service",
			Type:      "SERVICE",
			Health:    "HEALTHY",
			RPS:       340.2,
			LatencyMs: 14.5,
			ErrorPct:  0.01,
		},
		{
			ID:        "payments-service",
			Label:     "Payments & Checkout",
			Type:      "SERVICE",
			Health:    "DEGRADED",
			RPS:       520.8,
			LatencyMs: 64.2,
			ErrorPct:  3.12,
		},
		{
			ID:        "telemetry-engine",
			Label:     "Telemetry Ingestion",
			Type:      "SERVICE",
			Health:    "HEALTHY",
			RPS:       2840.0,
			LatencyMs: 12.0,
			ErrorPct:  0.00,
		},
		{
			ID:        "timescale-db",
			Label:     "TimescaleDB Primary",
			Type:      "DATABASE",
			Health:    "DEGRADED",
			RPS:       1850.4,
			LatencyMs: 48.6,
			ErrorPct:  4.20,
		},
		{
			ID:        "cache-redis",
			Label:     "Redis Session Cache",
			Type:      "CACHE",
			Health:    "HEALTHY",
			RPS:       1120.0,
			LatencyMs: 1.8,
			ErrorPct:  0.00,
		},
	},
	Edges: []MapEdge{
		{
			Source:    "edge-ingress",
			Target:    "auth-gateway",
			CallRate:  340.2,
			LatencyMs: 14.5,
			Status:    "OK",
		},
		{
			Source:    "edge-ingress",
			Target:    "payments-service",
			CallRate:  520.8,
			LatencyMs: 64.2,
			Status:    "SLOW",
		},
		{
			Source:    "edge-ingress",
			Target:    "telemetry-engine",
			CallRate:  1840.0,
			LatencyMs: 12.0,
			Status:    "OK",
		},
		{
			Source:    "auth-gateway",
			Target:    "cache-redis",
			CallRate:  310.0,
			LatencyMs: 1.8,
			Status:    "OK",
		},
		{
			Source:    "payments-service",
			Target:    "timescale-db",
			CallRate:  480.2,
			LatencyMs: 78.4,
			Status:    "ERROR",
		},
		{
			Source:    "telemetry-engine",
			Target:    "timescale-db",
			CallRate:  1850.0,
			LatencyMs: 18.2,
			Status:    "OK",
		},
	},
}

var defaultSynthetics = []SyntheticCheckResult{
	{
		ID:           "syn-001",
		Name:         "Global Public API Gateway Uptime",
		TargetURL:    "https://api.sentrix.internal/health/ready",
		Type:         "HTTP",
		IntervalSec:  30,
		Status:       "PASSING",
		LatencyMs:    24.2,
		DNSMs:        2.1,
		TLSMs:        6.8,
		TTFBMs:       15.3,
		Availability: 99.99,
		LastCheckAt:  time.Now().UTC(),
	},
	{
		ID:           "syn-002",
		Name:         "Checkout Stripe Settlement Webhook Endpoint",
		TargetURL:    "https://payments.sentrix.internal/v1/webhook/health",
		Type:         "HTTP",
		IntervalSec:  60,
		Status:       "PASSING",
		LatencyMs:    68.4,
		DNSMs:        3.4,
		TLSMs:        12.1,
		TTFBMs:       52.9,
		Availability: 99.94,
		LastCheckAt:  time.Now().UTC(),
	},
	{
		ID:           "syn-003",
		Name:         "Core DNS Resolver Resolution Check",
		TargetURL:    "dns://1.1.1.1:53 (internal-cluster.zone)",
		Type:         "DNS",
		IntervalSec:  15,
		Status:       "PASSING",
		LatencyMs:    1.4,
		DNSMs:        1.4,
		TLSMs:        0.0,
		TTFBMs:       0.0,
		Availability: 100.0,
		LastCheckAt:  time.Now().UTC(),
	},
}

// GET /api/v1/service-map
func HandleGetServiceMap(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		api.RespondJSON(w, http.StatusOK, defaultServiceMap)
	}
}

// GET /api/v1/synthetics
func HandleGetSynthetics(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		api.RespondJSON(w, http.StatusOK, defaultSynthetics)
	}
}
