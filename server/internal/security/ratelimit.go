package security

import (
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"golang.org/x/time/rate"
)

type client struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

type RateLimiter struct {
	mu      sync.Mutex
	rate    rate.Limit
	burst   int
	clients map[string]*client
}

func NewRateLimiter(perSecond float64, burst int) *RateLimiter {
	rl := &RateLimiter{
		rate:    rate.Limit(perSecond),
		burst:   burst,
		clients: make(map[string]*client),
	}

	go rl.cleanupLoop()

	return rl
}

func (rl *RateLimiter) cleanupLoop() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		now := time.Now()

		rl.mu.Lock()

		for key, c := range rl.clients {
			if now.Sub(c.lastSeen) > 10*time.Minute {
				delete(rl.clients, key)
			}
		}

		rl.mu.Unlock()
	}
}

func (rl *RateLimiter) Allow(key string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	c, ok := rl.clients[key]
	if !ok {
		c = &client{
			limiter: rate.NewLimiter(rl.rate, rl.burst),
		}
		rl.clients[key] = c
	}

	c.lastSeen = time.Now()

	return c.limiter.Allow()
}

func HTTPRateLimit(
	limiter *RateLimiter,
	keyFunc func(*http.Request) string,
	message string,
) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			key := keyFunc(r)

			if !limiter.Allow(key) {
				w.Header().Set("Retry-After", "60")
				http.Error(w, message, http.StatusTooManyRequests)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func IPKey(r *http.Request) string {
	return ClientIP(r)
}

func ClientIP(r *http.Request) string {
	forwarded := r.Header.Get("X-Forwarded-For")
	if forwarded != "" {
		parts := strings.Split(forwarded, ",")
		return strings.TrimSpace(parts[0])
	}

	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}

	return host
}
