package realtime

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/coder/websocket"

	"github.com/sentrix/server/internal/auth"
)

type Client struct {
	hub    *Hub
	conn   *websocket.Conn
	send   chan []byte
	userID string
}

type Hub struct {
	bus        *Bus
	clients    map[*Client]struct{}
	register   chan *Client
	unregister chan *Client
}

func NewHub(bus *Bus) *Hub {
	return &Hub{
		bus:        bus,
		clients:    make(map[*Client]struct{}),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

func (h *Hub) Run() {
	events := h.bus.Subscribe()

	for {
		select {
		case client := <-h.register:
			h.clients[client] = struct{}{}

			slog.Info("websocket client connected",
				"user_id", client.userID,
				"clients", len(h.clients),
			)

		case client := <-h.unregister:
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)

				slog.Info("websocket client disconnected",
					"user_id", client.userID,
					"clients", len(h.clients),
				)
			}

		case event := <-events:
			message, err := json.Marshal(event)
			if err != nil {
				slog.Error("failed to marshal realtime event", "error", err)
				continue
			}

			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					slog.Warn("websocket client too slow; dropping event",
						"user_id", client.userID,
						"event_type", event.Type,
					)
				}
			}
		}
	}
}

// POST /api/v1/auth/ws-ticket
func HandleIssueTicket(store *TicketStore) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := auth.GetUser(r)

		if user == nil {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		ticket := store.Issue(user.ID)

		if ticket == "" {
			http.Error(w, "failed to issue websocket ticket", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"ticket":     ticket,
			"expires_in": 30,
		})
	}
}

// GET /api/v1/ws?ticket=...
func HandleWebSocket(hub *Hub, store *TicketStore) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ticket := r.URL.Query().Get("ticket")

		if ticket == "" {
			http.Error(w, "ticket is required", http.StatusBadRequest)
			return
		}

		userID, ok := store.Consume(ticket)
		if !ok {
			http.Error(w, "invalid or expired websocket ticket", http.StatusUnauthorized)
			return
		}

		opts := &websocket.AcceptOptions{}

		origin := os.Getenv("WEB_ORIGIN")
		if origin != "" {
			opts.OriginPatterns = []string{origin}
		} else {
			// Development only.
			// In production, set WEB_ORIGIN.
			opts.InsecureSkipVerify = true
		}

		conn, err := websocket.Accept(w, r, opts)
		if err != nil {
			slog.Error("websocket accept failed", "error", err)
			return
		}

		ctx, cancel := context.WithCancel(r.Context())

		client := &Client{
			hub:    hub,
			conn:   conn,
			send:   make(chan []byte, 256),
			userID: userID,
		}

		hub.register <- client

		go func() {
			defer cancel()
			client.readPump(ctx)
		}()

		go client.writePump(ctx)
	}
}

func (c *Client) readPump(ctx context.Context) {
	defer func() {
		c.hub.unregister <- c
		_ = c.conn.Close(websocket.StatusNormalClosure, "connection closed")
	}()

	c.conn.SetReadLimit(1024)

	for {
		_, _, err := c.conn.Read(ctx)
		if err != nil {
			return
		}
	}
}

func (c *Client) writePump(ctx context.Context) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			_ = c.conn.Close(websocket.StatusNormalClosure, "context canceled")
			return

		case message, ok := <-c.send:
			if !ok {
				_ = c.conn.Close(websocket.StatusNormalClosure, "send channel closed")
				return
			}

			writeCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)

			err := c.conn.Write(writeCtx, websocket.MessageText, message)
			cancel()

			if err != nil {
				return
			}

		case <-ticker.C:
			pingCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)

			err := c.conn.Ping(pingCtx)
			cancel()

			if err != nil {
				return
			}
		}
	}
}
