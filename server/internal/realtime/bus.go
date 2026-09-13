package realtime

import (
	"log/slog"
	"sync"
	"time"
)

type Event struct {
	Type      string         `json:"type"`
	Timestamp time.Time      `json:"timestamp"`
	Payload   map[string]any `json:"payload,omitempty"`
}

type Bus struct {
	mu   sync.RWMutex
	subs map[chan Event]struct{}
}

func NewBus() *Bus {
	return &Bus{
		subs: make(map[chan Event]struct{}),
	}
}

func (b *Bus) Subscribe() chan Event {
	ch := make(chan Event, 256)

	b.mu.Lock()
	defer b.mu.Unlock()

	b.subs[ch] = struct{}{}

	return ch
}

func (b *Bus) Unsubscribe(ch chan Event) {
	b.mu.Lock()
	defer b.mu.Unlock()

	if _, ok := b.subs[ch]; ok {
		delete(b.subs, ch)
		close(ch)
	}
}

func (b *Bus) Publish(event Event) {
	b.mu.RLock()
	defer b.mu.RUnlock()

	for ch := range b.subs {
		select {
		case ch <- event:
		default:
			slog.Warn("realtime subscriber too slow; dropping event",
				"event_type", event.Type,
			)
		}
	}
}
