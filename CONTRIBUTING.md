# Contributing to TraderMemos

## Development setup

### Prerequisites

- **Go** 1.26+ (via [mise](https://mise.jdx.dev/) — see `mise.toml`)
- **Node** + **pnpm** (web)
- **sqlc** (optional; for regenerating store code)

### Clone and bootstrap

```bash
git clone <repo-url>
cd TraderMemos
make setup           # mise + air + pnpm install; seeds api/.env

# Optional: edit api/.env (TM_JWT_SECRET, TM_DB_PATH, …)
# See api/.env.example for the full list.

make dev             # API :8080 (air) + web :5173 (vite) with hot reload
```

SQLite under `api/data/` is the zero-config path — no Postgres/Redis required.

Useful targets:

| Target        | What it does                          |
|---------------|----------------------------------------|
| `make dev`    | API + web together (Ctrl+C stops both) |
| `make dev-api`| API only (air)                         |
| `make dev-web`| Web only (vite)                        |
| `make kill`   | Free ports 8080 / 5173 + air processes |
| `make test`   | Go + web unit tests                    |
| `make sqlc`   | Regenerate `api/internal/store`        |

Vite proxies `/api` → `http://localhost:8080`.

### Project structure

```
api/         Go backend (Echo, sqlc, golang-migrate, SQLite)
web/         React SPA (Vite, TanStack Router)
mobile/      Expo (planned)
docs/        Specs / roadmaps
DESIGN.md    Signal Terminal design system — read before UI work
```

### Design

UI work must follow `DESIGN.md` (Signal Terminal). Do not invent alternate type/color/radius without explicit approval.
