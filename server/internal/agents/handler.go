package agents

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"net"
	"net/http"
	"os"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/sentrix/server/internal/auth"
)

type EnrollmentRequest struct {
	Token        string `json:"token"`
	Hostname     string `json:"hostname"`
	Platform     string `json:"platform"`
	Architecture string `json:"architecture"`
	AgentVersion string `json:"agent_version"`
}

type EnrollmentResponse struct {
	AgentID    string `json:"agent_id"`
	Credential string `json:"credential"`
	ServerURL  string `json:"server_url"`
}

type CreateEnrollmentTokenRequest struct {
	Description      string `json:"description"`
	ExpiresInSeconds int    `json:"expires_in_seconds"`
}

type EnrollmentTokenListItem struct {
	ID          string     `json:"id"`
	Description string     `json:"description"`
	ExpiresAt   time.Time  `json:"expires_at"`
	UsedAt      *time.Time `json:"used_at"`
	RevokedAt   *time.Time `json:"revoked_at"`
	CreatedAt   time.Time  `json:"created_at"`
}

func hashToken(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return base64.StdEncoding.EncodeToString(sum[:])
}

func generateRawToken(prefix string) (string, error) {
	raw := make([]byte, 32)

	_, err := rand.Read(raw)
	if err != nil {
		return "", err
	}

	return prefix + "_" + base64.RawURLEncoding.EncodeToString(raw), nil
}

func remoteIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}

	return host
}

func publicServerURL(r *http.Request) string {
	publicURL := os.Getenv("SENTRIX_PUBLIC_URL")
	if publicURL != "" {
		return publicURL
	}

	scheme := "http"
	if r.TLS != nil {
		scheme = "https"
	}

	return scheme + "://" + r.Host
}

// POST /api/v1/agents/enrollment-tokens
func HandleCreateEnrollmentToken(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req CreateEnrollmentTokenRequest

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid JSON", http.StatusBadRequest)
			return
		}

		if req.ExpiresInSeconds <= 0 {
			req.ExpiresInSeconds = 3600
		}

		if req.ExpiresInSeconds > 7*24*3600 {
			req.ExpiresInSeconds = 7 * 24 * 3600
		}

		rawToken, err := generateRawToken("enr")
		if err != nil {
			http.Error(w, "failed to generate token", http.StatusInternalServerError)
			return
		}

		tokenHash := hashToken(rawToken)
		expiresAt := time.Now().Add(time.Duration(req.ExpiresInSeconds) * time.Second)
		id := uuid.New()

		actor := auth.GetUser(r)
		var actorID *string
		if actor != nil {
			actorID = &actor.ID
		}

		_, err = pool.Exec(r.Context(), `
			INSERT INTO enrollment_tokens (
				id,
				token_hash,
				description,
				created_by,
				expires_at
			) VALUES (
				$1, $2, $3, $4, $5
			)
		`, id, tokenHash, req.Description, actorID, expiresAt)

		if err != nil {
			http.Error(w, "database insert failed", http.StatusInternalServerError)
			return
		}

		auth.WriteAudit(
			r.Context(),
			pool,
			actorID,
			"agent_enrollment_token.create",
			"enrollment_token",
			id.String(),
			auth.ClientIP(r),
			map[string]any{
				"description": req.Description,
				"expires_at":  expiresAt,
			},
		)

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]any{
			"id":         id.String(),
			"token":      rawToken,
			"expires_at": expiresAt,
		})
	}
}

// GET /api/v1/agents/enrollment-tokens
func HandleListEnrollmentTokens(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, err := pool.Query(r.Context(), `
			SELECT
				id,
				description,
				expires_at,
				used_at,
				revoked_at,
				created_at
			FROM enrollment_tokens
			ORDER BY created_at DESC
			LIMIT 100
		`)

		if err != nil {
			http.Error(w, "database query failed", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		items := []EnrollmentTokenListItem{}

		for rows.Next() {
			var item EnrollmentTokenListItem

			err := rows.Scan(
				&item.ID,
				&item.Description,
				&item.ExpiresAt,
				&item.UsedAt,
				&item.RevokedAt,
				&item.CreatedAt,
			)

			if err != nil {
				http.Error(w, "scan failed", http.StatusInternalServerError)
				return
			}

			items = append(items, item)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(items)
	}
}

// POST /api/v1/agents/enrollment-tokens/{tokenID}/revoke
func HandleRevokeEnrollmentToken(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		tokenID := chi.URLParam(r, "tokenID")

		_, err := pool.Exec(r.Context(), `
			UPDATE enrollment_tokens
			SET revoked_at = NOW()
			WHERE id = $1
			  AND revoked_at IS NULL
			  AND used_at IS NULL
		`, tokenID)

		if err != nil {
			http.Error(w, "database update failed", http.StatusInternalServerError)
			return
		}

		actor := auth.GetUser(r)
		var actorID *string
		if actor != nil {
			actorID = &actor.ID
		}

		auth.WriteAudit(
			r.Context(),
			pool,
			actorID,
			"agent_enrollment_token.revoke",
			"enrollment_token",
			tokenID,
			auth.ClientIP(r),
			nil,
		)

		w.WriteHeader(http.StatusNoContent)
	}
}

// POST /api/v1/agent/enroll
func HandleEnroll(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req EnrollmentRequest

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid JSON", http.StatusBadRequest)
			return
		}

		if req.Token == "" || req.Hostname == "" || req.Platform == "" || req.Architecture == "" {
			http.Error(w, "token, hostname, platform, and architecture are required", http.StatusBadRequest)
			return
		}

		ctx := r.Context()
		tokenHash := hashToken(req.Token)

		tx, err := pool.Begin(ctx)
		if err != nil {
			http.Error(w, "database error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(ctx)

		var enrollmentTokenID string

		err = tx.QueryRow(ctx, `
			SELECT id
			FROM enrollment_tokens
			WHERE token_hash = $1
			  AND used_at IS NULL
			  AND revoked_at IS NULL
			  AND expires_at > NOW()
			FOR UPDATE
		`, tokenHash).Scan(&enrollmentTokenID)

		if err == pgx.ErrNoRows {
			http.Error(w, "invalid or expired enrollment token", http.StatusUnauthorized)
			return
		}

		if err != nil {
			http.Error(w, "database error", http.StatusInternalServerError)
			return
		}

		_, err = tx.Exec(ctx, `
			UPDATE enrollment_tokens
			SET used_at = NOW()
			WHERE id = $1
		`, enrollmentTokenID)

		if err != nil {
			http.Error(w, "database error", http.StatusInternalServerError)
			return
		}

		agentID := uuid.New()

		credential, err := generateRawToken("agtc")
		if err != nil {
			http.Error(w, "failed to generate agent credential", http.StatusInternalServerError)
			return
		}

		credentialHash := hashToken(credential)

		_, err = tx.Exec(ctx, `
			INSERT INTO agents (
				id,
				name,
				credential_hash,
				status
			) VALUES (
				$1, $2, $3, 'ACTIVE'
			)
		`, agentID, req.Hostname, credentialHash)

		if err != nil {
			http.Error(w, "database insert failed", http.StatusInternalServerError)
			return
		}

		serverID := uuid.New()
		ip := remoteIP(r)

		_, err = tx.Exec(ctx, `
			INSERT INTO servers (
				id,
				agent_id,
				name,
				hostname,
				platform,
				architecture,
				ip_address,
				agent_version,
				status,
				registered_at
			) VALUES (
				$1, $2, $3, $4, $5, $6, $7, $8, 'OFFLINE', NOW()
			)
		`,
			serverID,
			agentID,
			req.Hostname,
			req.Hostname,
			req.Platform,
			req.Architecture,
			ip,
			req.AgentVersion,
		)

		if err != nil {
			http.Error(w, "database insert failed", http.StatusInternalServerError)
			return
		}

		if err := tx.Commit(ctx); err != nil {
			http.Error(w, "database error", http.StatusInternalServerError)
			return
		}

		auth.WriteAudit(
			ctx,
			pool,
			nil,
			"agent.enroll",
			"agent",
			agentID.String(),
			auth.ClientIP(r),
			map[string]any{
				"hostname":     req.Hostname,
				"platform":     req.Platform,
				"architecture": req.Architecture,
				"agent_version": req.AgentVersion,
			},
		)

		resp := EnrollmentResponse{
			AgentID:    agentID.String(),
			Credential: credential,
			ServerURL:  publicServerURL(r),
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}
}
