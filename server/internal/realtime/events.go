package realtime

import "time"

var defaultBus *Bus

func SetDefaultBus(bus *Bus) {
	defaultBus = bus
}

func Publish(event Event) {
	if defaultBus == nil {
		return
	}

	defaultBus.Publish(event)
}

func PublishDashboardUpdated() {
	Publish(Event{
		Type:      "dashboard.updated",
		Timestamp: time.Now().UTC(),
	})
}

func PublishServerUpdated(serverID string) {
	Publish(Event{
		Type:      "server.updated",
		Timestamp: time.Now().UTC(),
		Payload: map[string]any{
			"server_id": serverID,
		},
	})
}

func PublishServerTelemetry(serverID string) {
	Publish(Event{
		Type:      "server.telemetry",
		Timestamp: time.Now().UTC(),
		Payload: map[string]any{
			"server_id": serverID,
		},
	})
}

func PublishIncidentUpdated(incidentID string, serverID string) {
	Publish(Event{
		Type:      "incident.updated",
		Timestamp: time.Now().UTC(),
		Payload: map[string]any{
			"incident_id": incidentID,
			"server_id":   serverID,
		},
	})
}

func PublishCheckUpdated(checkID string, serverID string, state string) {
	Publish(Event{
		Type:      "check.updated",
		Timestamp: time.Now().UTC(),
		Payload: map[string]any{
			"check_id":  checkID,
			"server_id": serverID,
			"state":     state,
		},
	})
}

func PublishAlertStateChanged(ruleID string, serverID string, state string) {
	Publish(Event{
		Type:      "alert.state_changed",
		Timestamp: time.Now().UTC(),
		Payload: map[string]any{
			"rule_id":   ruleID,
			"server_id": serverID,
			"state":     state,
		},
	})
}
