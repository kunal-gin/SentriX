package realtime

import (
	"crypto/rand"
	"encoding/base64"
	"sync"
	"time"
)

type ticketEntry struct {
	UserID    string
	ExpiresAt time.Time
}

type TicketStore struct {
	mu      sync.Mutex
	tickets map[string]ticketEntry
}

func NewTicketStore() *TicketStore {
	return &TicketStore{
		tickets: make(map[string]ticketEntry),
	}
}

func (s *TicketStore) Issue(userID string) string {
	raw := make([]byte, 32)

	_, err := rand.Read(raw)
	if err != nil {
		return ""
	}

	ticket := base64.RawURLEncoding.EncodeToString(raw)

	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()

	// opportunistic cleanup
	for key, entry := range s.tickets {
		if entry.ExpiresAt.Before(now) {
			delete(s.tickets, key)
		}
	}

	s.tickets[ticket] = ticketEntry{
		UserID:    userID,
		ExpiresAt: now.Add(30 * time.Second),
	}

	return ticket
}

func (s *TicketStore) Consume(ticket string) (string, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	entry, ok := s.tickets[ticket]
	if !ok {
		return "", false
	}

	delete(s.tickets, ticket)

	if time.Now().After(entry.ExpiresAt) {
		return "", false
	}

	return entry.UserID, true
}
