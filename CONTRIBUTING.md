# Contributing to TraderMemos

## Development setup

### Prerequisites

- **Go** 1.26+ (via [mise](https://mise.jdx.dev/) — see `mise.toml`)
- **Node** 24 LTS (via Vite+ `web/.node-version` or mise) + **pnpm** 11 + **Vite+** (`vp` CLI)
- **sqlc** (optional; for regenerating store code)

### Clone and bootstrap

```bash
git clone <repo-url>
cd TraderMemos
make setup           # mise + air + vp install; seeds api/.env

# Web validation (from repo root)
make check           # go vet + vp check
make test            # go test + vp test

# Optional: edit api/.env (TM_JWT_SECRET, TM_DATABASE_URL, …)
# See api/.env.example for the full list.

make dev             # API :8080 (air) + web :5173 (vite) with hot reload
```

SQLite under `api/data/` is the zero-config path — no Postgres/Redis required.

Useful targets:

| Target        | What it does                          |
|---------------|----------------------------------------|
| `make dev`    | API + web together (Ctrl+C stops both) |
| `make dev-api`| API only (air)                         |
| `make dev-web`| Vite+ dev server only                   |
| `make kill`   | Free ports 8080 / 5173 + air processes |
| `make check`  | Go vet + Vite+ check (lint/fmt/types) |
| `make test`   | Go + web unit tests                    |
| `make sqlc`   | Regenerate `api/internal/store`        |

Vite+ proxies `/api` → `http://localhost:8080` during `vp dev`.

### Self-host / deploy

See **[docs/fork-deploy.md](docs/fork-deploy.md)** to put the SPA on your Vercel/Cloudflare account, and **[docs/deploy.md](docs/deploy.md)** for Docker / CORS / edge rewrite. Deploy buttons: [README](README.md).

```bash
make up          # pull Hub images: web :3000 (SPA + /api proxy), api :8080
make up-build    # build Dockerfiles from this checkout instead
make down
make logs
```

Hub namespace / tag: copy [`.env.example`](.env.example) → `.env` and set `DOCKERHUB_USERNAME` / `TM_IMAGE_TAG`. CI publish uses GitHub secrets `DOCKERHUB_USERNAME` + `DOCKERHUB_TOKEN`.

### Vite+ commands (run from `web/`)

| Command | What it does |
|---------|--------------|
| `vp dev` | Dev server (:5173) |
| `vp build` | Production bundle |
| `vp test` | Unit tests (Vitest) |
| `vp check` | Lint + format + typecheck |
| `vp fmt` | Format only |
| `vp staged` | Check staged files (also runs on pre-commit) |
| `pnpm run …` | Same scripts via pnpm (`dev`, `test`, `build`, …) |

### Project structure

```
api/         Go backend (Echo, sqlc, golang-migrate, SQLite)
web/         React SPA (Vite+, TanStack Router)
mobile/      Expo (planned)
docs/        Specs / roadmaps
DESIGN.md    Signal Terminal design system — read before UI work
```

### Design

UI work must follow `DESIGN.md` (Signal Terminal). Do not invent alternate type/color/radius without explicit approval.
