package metrics

import (
	"crypto/sha256"
	"encoding/base64"
	"testing"
	"time"
)

func TestHashCredential(t *testing.T) {
	raw := "stx-agent-credential-secret-key-12345"
	expectedSum := sha256.Sum256([]byte(raw))
	expected := base64.StdEncoding.EncodeToString(expectedSum[:])

	result := hashCredential(raw)
	if result != expected {
		t.Fatalf("hashCredential failed: expected %s, got %s", expected, result)
	}
}

func TestTelemetryPayloadStructure(t *testing.T) {
	payload := TelemetryPayload{
		AgentID:   "agt-001",
		Timestamp: time.Now(),
		Sequence:  42,
		Metrics: []Metric{
			{Name: "cpu_usage", Value: 45.2, Unit: "percent", Labels: map[string]string{"core": "0"}},
			{Name: "memory_usage", Value: 72.1, Unit: "percent"},
		},
	}

	if len(payload.Metrics) != 2 {
		t.Fatalf("Expected 2 metrics, got %d", len(payload.Metrics))
	}
	if payload.Metrics[0].Name != "cpu_usage" {
		t.Errorf("Expected cpu_usage, got %s", payload.Metrics[0].Name)
	}
	if payload.Metrics[0].Labels["core"] != "0" {
		t.Errorf("Expected core 0 label, got %s", payload.Metrics[0].Labels["core"])
	}
}
