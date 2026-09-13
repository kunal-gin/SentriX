package auth

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type createUserRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Role     string `json:"role"`
}

type userListItem struct {
	ID          string     `json:"id"`
	Email       string     `json:"email"`
	Role        string     `json:"role"`
	Status      string     `json:"status"`
	CreatedAt   time.Time  `json:"created_at"`
	LastLoginAt *time.Time `json:"last_login_at"`
}

// GET /api/v1/users
func HandleListUsers(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, err := pool.Query(r.Context(), `
			SELECT
				id,
				email,
				role,
				status,
				created_at,
				last_login_at
			FROM users
			ORDER BY created_at DESC
		`)

		if err != nil {
			http.Error(w, "database query failed", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		users := []userListItem{}

		for rows.Next() {
			var user userListItem

			err := rows.Scan(
				&user.ID,
				&user.Email,
				&user.Role,
				&user.Status,
				&user.CreatedAt,
				&user.LastLoginAt,
			)

			if err != nil {
				http.Error(w, "scan failed", http.StatusInternalServerError)
				return
			}

			users = append(users, user)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(users)
	}
}

// POST /api/v1/users
func HandleCreateUser(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req createUserRequest

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid JSON", http.StatusBadRequest)
			return
		}

		if req.Email == "" || req.Password == "" {
			http.Error(w, "email and password are required", http.StatusBadRequest)
			return
		}

		if len(req.Password) < 8 {
			http.Error(w, "password must be at least 8 characters", http.StatusBadRequest)
			return
		}

		if req.Role == "" {
			req.Role = "VIEWER"
		}

		if req.Role != "ADMIN" && req.Role != "OPERATOR" && req.Role != "VIEWER" {
			http.Error(w, "invalid role", http.StatusBadRequest)
			return
		}

		passwordHash, err := HashPassword(req.Password)
		if err != nil {
			http.Error(w, "failed to hash password", http.StatusInternalServerError)
			return
		}

		id := uuid.New()

		_, err = pool.Exec(r.Context(), `
			INSERT INTO users (
				id,
				email,
				password_hash,
				role,
				status
			) VALUES (
				$1, lower($2), $3, $4, 'ACTIVE'
			)
		`, id, req.Email, passwordHash, req.Role)

		if err != nil {
			http.Error(w, "failed to create user", http.StatusInternalServerError)
			return
		}

		actor := GetUser(r)
		var actorID *string
		if actor != nil {
			actorID = &actor.ID
		}

		WriteAudit(
			r.Context(),
			pool,
			actorID,
			"user.create",
			"user",
			id.String(),
			ClientIP(r),
			map[string]any{
				"email": req.Email,
				"role":  req.Role,
			},
		)

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]string{
			"id": id.String(),
		})
	}
}
