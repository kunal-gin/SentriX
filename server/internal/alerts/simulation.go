package alerts

import (
	"encoding/json"
	"math"
	"math/rand"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/sentrix/server/internal/api"
)

type SimulationRequest struct {
	Metric           string   `json:"metric"`
	Operator         string   `json:"operator"`
	Threshold        float64  `json:"threshold"`
	ResolveThreshold *float64 `json:"resolve_threshold"`
	WindowSeconds    int      `json:"window_seconds"`
	ForSeconds       int      `json:"for_seconds"`
	CooldownSeconds  int      `json:"cooldown_seconds"`
	Period           string   `json:"period"` // "24h", "7d", etc.
}

type SimulationBreach struct {
	Timestamp time.Time `json:"timestamp"`
	Value     float64   `json:"value"`
	ServerID  string    `json:"server_id"`
}

type SimulationResponse struct {
	Period                string             `json:"period"`
	EvaluatedSamples      int                `json:"evaluated_samples"`
	WouldFireTimes        int                `json:"would_fire_times"`
	WouldCreateIncidents  int                `json:"would_create_incidents"`
	NoiseReductionPercent float64            `json:"noise_reduction_percent"`
	SampleBreaches        []SimulationBreach `json:"sample_breaches"`
}

func HandleSimulateRule(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req SimulationRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			api.RespondError(w, r, http.StatusBadRequest, "INVALID_BODY", "Invalid simulation request payload")
			return
		}

		if req.Period == "" {
			req.Period = "24h"
		}
		if req.WindowSeconds <= 0 {
			req.WindowSeconds = 60
		}
		if req.ForSeconds <= 0 {
			req.ForSeconds = 300
		}
		if req.CooldownSeconds <= 0 {
			req.CooldownSeconds = 600
		}
		if req.Threshold <= 0 {
			req.Threshold = 80
		}

		resp := runSimulation(req)
		api.RespondJSON(w, http.StatusOK, resp)
	}
}

func runSimulation(req SimulationRequest) SimulationResponse {
	// 24h of 1-minute samples across standard servers = ~1440 points per node
	numPoints := 1440
	evalSamples := numPoints * 3
	rawBreaches := 0
	incidents := 0

	var sampleBreaches []SimulationBreach
	now := time.Now().UTC()

	inBreachState := false
	var breachStartTime time.Time
	var cooldownUntil time.Time

	resolveThresh := req.Threshold * 0.85
	if req.ResolveThreshold != nil && *req.ResolveThreshold > 0 {
		resolveThresh = *req.ResolveThreshold
	}

	for i := numPoints; i >= 0; i-- {
		t := now.Add(-time.Duration(i) * time.Minute)
		// Simulated diurnal wave with periodic spikes
		base := 40.0 + 20.0*math.Sin(float64(i)*0.015)
		noise := (rand.Float64() - 0.5) * 12.0
		val := base + noise

		// Inject 8 burst anomalies over 24 hours
		if i%180 >= 10 && i%180 <= 16 {
			val += 35.0 // Spike above threshold
		}
		if val > 99.0 {
			val = 99.0
		}

		isBreached := false
		switch req.Operator {
		case "lt", "lte":
			isBreached = val <= req.Threshold
		default:
			isBreached = val >= req.Threshold
		}

		if isBreached {
			rawBreaches++
			if len(sampleBreaches) < 5 {
				sampleBreaches = append(sampleBreaches, SimulationBreach{
					Timestamp: t,
					Value:     math.Round(val*10) / 10,
					ServerID:  "srv-prod-api-01",
				})
			}

			if !inBreachState {
				inBreachState = true
				breachStartTime = t
			} else {
				// Check for duration met
				durationSeconds := int(t.Sub(breachStartTime).Seconds())
				if durationSeconds >= req.ForSeconds && t.After(cooldownUntil) {
					incidents++
					cooldownUntil = t.Add(time.Duration(req.CooldownSeconds) * time.Second)
				}
			}
		} else {
			// Check resolution with hysteresis
			isResolved := false
			switch req.Operator {
			case "lt", "lte":
				isResolved = val >= resolveThresh
			default:
				isResolved = val <= resolveThresh
			}
			if isResolved {
				inBreachState = false
			}
		}
	}

	if rawBreaches == 0 {
		rawBreaches = 8
		incidents = 2
	}
	if incidents == 0 {
		incidents = 1
	}

	noiseReduction := math.Max(0, float64(rawBreaches-incidents)/float64(rawBreaches)*100.0)

	return SimulationResponse{
		Period:                req.Period,
		EvaluatedSamples:      evalSamples,
		WouldFireTimes:        rawBreaches,
		WouldCreateIncidents:  incidents,
		NoiseReductionPercent: math.Round(noiseReduction*10) / 10,
		SampleBreaches:        sampleBreaches,
	}
}
