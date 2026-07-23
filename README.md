<div align="center">

# TraderMemos

**Self-hosted trading journal** — own your data, review your edge

<br/>

[![Go](https://img.shields.io/badge/Go-1.26+-00ADD8?logo=go&logoColor=white)](api/go.mod)
[![React](https://img.shields.io/badge/React-Vite+-61DAFB?logo=react&logoColor=black)](web/)
[![SQLite](https://img.shields.io/badge/SQLite-embedded-003B57?logo=sqlite&logoColor=white)](api/)
[![Self-hosted](https://img.shields.io/badge/Self--hosted-ready-8b5cf6)](docs/fork-deploy.md)

<br/>

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fsinhong2011%2FTraderMemos&root-directory=web&project-name=tradermemos&repository-name=tradermemos&env=VITE_API&envDescription=Optional%20API%20base%20URL%20(e.g.%20https%3A%2F%2Fapi.example.com%2Fapi%2Fv1).%20Leave%20empty%20to%20set%20Server%20at%20login.&envLink=https%3A%2F%2Fgithub.com%2Fsinhong2011%2FTraderMemos%2Fblob%2Fmain%2Fdocs%2Ffork-deploy.md)
[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https%3A%2F%2Fgithub.com%2Fsinhong2011%2FTraderMemos%2Ftree%2Fmain%2Fweb)
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/sinhong2011/TraderMemos)
[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/new/template?template=https%3A%2F%2Fgithub.com%2Fsinhong2011%2FTraderMemos&utm_medium=integration&utm_source=button&utm_campaign=tradermemos)

<br/>

[Fork guide](docs/fork-deploy.md)
·
[Docker](#docker-all-in-one)
·
[Contributing](CONTRIBUTING.md)
·
[Design](DESIGN.md)

</div>

---

## Why TraderMemos?

Cloud journals like **TradeZella** and **TraderSync** are polished — but your edge lives in the data.

TraderMemos follows the same self-hosting philosophy as **[Ghost](https://github.com/TryGhost/Ghost)**, **[Umami](https://github.com/umami-software/umami)**, and **[Plane](https://github.com/makeplane/plane)**: run it on your infrastructure, own the database, extend without permission. Inspired by the polish of **[Linear](https://linear.app)** and **[Cal.com](https://github.com/calcom/cal.com)'s** open-core clarity — applied to a trading terminal.

| | Cloud journals | TraderMemos |
|---|---|---|
| **Data ownership** | Vendor-hosted | Your SQLite / VPS |
| **Cost** | Monthly subscription | Free + your hosting |
| **AI keys** | Often vendor-managed | Your OpenAI-compatible API |
| **Customization** | Limited | Fork, patch, deploy |

## Features

- **Dashboard** — asymmetric bento stats, glowing P&L hero, step equity curve
- **Trade log** — virtualized table, execution detail, tags, setups, journal notes
- **P&L calendar** — daily heatmap with drill-down
- **Reports** — win rate, expectancy, setup/hourly/session breakdown
- **Playbook** — linked strategy library
- **Import** — CSV broker statements
- **Tools** — position-size calculator, risk rules, cash ledger
- **AI (optional)** — screenshot fill extraction + trade coach via OpenAI-compatible APIs
- **API access** — personal access tokens (`tm_pat_…`) for MCP/scripts; OpenAPI docs at `/docs`

## Tech stack

| Layer | Stack |
|-------|-------|
| **API** | Go · Echo · sqlc · golang-migrate · SQLite |
| **Web** | React · Vite+ · TanStack Router/Query/Form · Tailwind |
| **Mobile** | Expo (planned) |
| **Design** | Signal Terminal — see [DESIGN.md](DESIGN.md) |

## Quick start

### 1. Deploy the web UI

Click a **Deploy** button above — hosts the SPA on **your** Vercel / Cloudflare / Netlify account.

### 2. Run the API

```bash
make up   # local all-in-one → http://localhost:3000
```

Or use the **Railway** button (attach a Volume at `/data` for persistence).

### 3. Connect web → API

Allow your CDN origin on the API:

```bash
TM_CORS_ORIGINS=https://*.vercel.app,https://*.pages.dev,https://*.workers.dev,https://*.netlify.app,https://*.up.railway.app,http://localhost:5173
```

Open the web app → set **Server** to your API URL (or set `VITE_API` at build time). Leave **Server** blank only for same-origin Docker.

| Button | Deploys |
|--------|---------|
| Vercel / Cloudflare / Netlify | Web SPA (`web/`) |
| Railway | Go API ([`railway.toml`](railway.toml) → `api/Dockerfile`) |

> CDN hosts the **web UI**. Railway/Docker hosts the **API** (SQLite + uploads).

Already forked? Import your fork → Root **`web`** (Vercel/CF) or [`netlify.toml`](netlify.toml) / [`railway.toml`](railway.toml). Details: [docs/fork-deploy.md](docs/fork-deploy.md).

## Docker all-in-one

```bash
cp .env.example .env   # optional: DOCKERHUB_USERNAME, TM_IMAGE_TAG
make up                # pull Hub images → http://localhost:3000
# make up-build        # or build from this repo
```

Same-origin `/api` — no CORS, blank Server field.

On first visit with an empty database, the **setup wizard** creates the owner account. For production, set `TM_JWT_SECRET=$(openssl rand -hex 32)` and put TLS (Caddy/Traefik) in front — see [docs/deploy.md](docs/deploy.md).

## Development

```bash
git clone https://github.com/sinhong2011/TraderMemos.git
cd TraderMemos
make setup && make dev   # API :8080 + web :5173
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for targets, Vite+ commands, and project structure.

## Docs

| Doc | Topic |
|-----|--------|
| [docs/fork-deploy.md](docs/fork-deploy.md) | One-click / fork → Vercel, Cloudflare, Netlify, Railway |
| [docs/deploy.md](docs/deploy.md) | Docker, CORS, edge rewrite |
| [docs/release.md](docs/release.md) | Versioning, changelogs, GitHub Releases |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Local dev (`make dev`) |
| [DESIGN.md](DESIGN.md) | Signal Terminal UI system |

## Similar projects

TraderMemos sits alongside other self-hosted tools traders and builders reach for:

- **[Ghost](https://github.com/TryGhost/Ghost)** — publishing you own
- **[Umami](https://github.com/umami-software/umami)** — analytics you own
- **[Plane](https://github.com/makeplane/plane)** — project tracking you own
- **[Cal.com](https://github.com/calcom/cal.com)** — scheduling you own

TraderMemos brings that same sovereignty to **performance review**.
