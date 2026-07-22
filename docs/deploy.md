# TraderMemos deployment
#
# Supported shapes:
#   0. Fork / one-click web on your Vercel or Cloudflare — see fork-deploy.md
#   1. Docker all-in-one (default / self-host)
#   2. Static SPA + API elsewhere (CORS + Server URL)
#   3. Static SPA with edge rewrite to API (same-origin from the browser)

## 0. Deploy web to *your* Vercel / Cloudflare (fork-friendly)

**Start here if you forked the repo or want one-click onto your own account:**

→ **[fork-deploy.md](fork-deploy.md)** (Vercel + Cloudflare buttons, import-your-fork steps, CORS)

Quick links:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fsinhong2011%2FTraderMemos&root-directory=web&project-name=tradermemos&repository-name=tradermemos&env=VITE_API&envDescription=Optional%20API%20base%20URL%20(e.g.%20https%3A%2F%2Fapi.example.com%2Fapi%2Fv1).%20Leave%20empty%20to%20set%20Server%20at%20login.&envLink=https%3A%2F%2Fgithub.com%2Fsinhong2011%2FTraderMemos%2Fblob%2Fmain%2Fdocs%2Ffork-deploy.md)
[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https%3A%2F%2Fgithub.com%2Fsinhong2011%2FTraderMemos%2Ftree%2Fmain%2Fweb)
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/sinhong2011/TraderMemos)
[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/new/template?template=https%3A%2F%2Fgithub.com%2Fsinhong2011%2FTraderMemos&utm_medium=integration&utm_source=button&utm_campaign=tradermemos)

```bash
# On your API host after the UI is live:
TM_CORS_ORIGINS=https://*.vercel.app,https://*.pages.dev,https://*.workers.dev,https://*.netlify.app,https://*.up.railway.app,http://localhost:5173
```

---

## 1. Docker all-in-one (recommended default)

```bash
# From repo root — builds api + web, serves SPA at :3000
make up          # docker compose up --build -d
# open http://localhost:3000
```

What you get:

| URL | Service |
|-----|---------|
| `http://localhost:3000` | nginx SPA |
| `http://localhost:3000/api/v1/*` | proxied → Go API |
| `http://localhost:8080` | API direct (optional; health, debug) |

Leave the login/settings **Server** field blank. The SPA uses relative `/api/v1`, and nginx proxies to the `api` container — no CORS required.

Important env (compose / host):

| Variable | Purpose |
|----------|---------|
| `TM_JWT_SECRET` | JWT signing secret — **required** for production (`openssl rand -hex 32`) |
| `TM_ALLOW_INSECURE_JWT` | Compose defaults `true` for first-run convenience; set `false`/unset in production |
| `TM_ALLOW_REGISTRATION` | Default `false`. After setup, only the owner exists unless you opt in |
| `TM_DB_PATH` | SQLite path inside the API volume (`/data/tradermemos.db`) |
| `TM_CORS_ORIGINS` | Leave empty for this mode |

**First boot:** open `http://localhost:3000` — if the database has no users, the **setup wizard** creates the owner (admin) account and an optional trading account. Public registration stays closed afterward.

```bash
# Production-ish compose example
export TM_JWT_SECRET=$(openssl rand -hex 32)
export TM_ALLOW_INSECURE_JWT=false
make up
```

Data lives in the `tm_data` Docker volume (SQLite + attachments).

```bash
make logs        # follow compose logs
make down        # stop stack
```

Production tip: put **Caddy / Traefik / nginx** in front for **TLS** and point it at the `web` service only — `/api` stays same-origin. Do not expose the API without TLS on the public internet.

### Auth hardening (built-in)

- First-user **setup** endpoint; open `/auth/register` is disabled by default
- Passwords must be **≥ 10** characters (bcrypt)
- Auth + setup routes are **rate-limited** (~2 req/s per IP)
- Access vs refresh JWTs use distinct `typ` claims
- Server **refuses to start** on a known-insecure JWT secret unless `TM_ALLOW_INSECURE_JWT=true`

### API access tokens & OpenAPI docs

Create long-lived tokens in **Settings → API** for MCP, AI agents, or scripts. They have the same API power as your user account.

```bash
# Call any protected route with the token shown once at create time
curl -H "Authorization: Bearer tm_pat_…" https://your-host/api/v1/accounts
```

Browse the interactive OpenAPI reference (Scalar):

| Setup | Docs URL |
|-------|----------|
| Docker all-in-one (`web` nginx) | `http://localhost:3000/docs` |
| API directly | `http://localhost:8080/docs` |
| Split API host | `https://api.example.com/docs` |

Raw spec: `/openapi.yaml` on the same host. Docs are public; protect the host with TLS and network controls as usual.

---

## 2. Static web (Vercel / Cloudflare Pages / Netlify) + API elsewhere

Use when the UI is on a CDN and the journal API runs on a VPS, Fly, home NAS, etc.

```
https://app.example.com     → static SPA (CDN)
https://api.example.com     → Docker/Go API + SQLite volume
```

### API

1. Run the API container (or binary) with a reachable URL and persistent disk.
2. Allow the SPA origin:

```bash
TM_CORS_ORIGINS=https://*.vercel.app,https://*.pages.dev,http://localhost:5173
TM_JWT_SECRET=$(openssl rand -hex 32)
# Do not set TM_ALLOW_INSECURE_JWT on public APIs
# TM_ALLOW_REGISTRATION=true   # only if you want extra users via the UI
```

Wildcard forms `https://*.vercel.app` and `https://*.pages.dev` match preview/production CDN hosts. Use exact origins for custom domains.

### Web

Build the SPA and deploy `web/dist`:

```bash
cd web && vp install && vp build
```

Point the SPA at the API:

| Method | When |
|--------|------|
| Login / Settings → **Server** / **API server** | User brings their own API (runtime `tm_api_base`) |
| Build-time `VITE_API=https://api.example.com/api/v1` | Fixed public/demo API baked into the build |

Origin-only values (e.g. `https://api.example.com`) get `/api/v1` appended automatically.

Sample platform configs:

- [`web/vercel.json`](../web/vercel.json) — used by one-click / Git import (SPA)
- [`deploy/vercel.json.example`](../deploy/vercel.json.example) — optional `/api` edge rewrite (mode 3)
- [`deploy/cloudflare/_redirects.example`](../deploy/cloudflare/_redirects.example) — optional CF `/api` proxy

---

## 3. Static web + edge rewrite (same-origin CDN)

Keep the browser on one origin; the edge proxies `/api` to your API. No CORS and no Server field.

### Vercel

Copy [`deploy/vercel.json.example`](../deploy/vercel.json.example), set `destination` to your API host, deploy `web/dist` (or connect the `web/` project with `outputDirectory: dist`).

### Cloudflare Pages

Copy [`deploy/cloudflare/_redirects.example`](../deploy/cloudflare/_redirects.example) into the build output as `_redirects` (e.g. `web/public/_redirects` before `vp build`), with a `200` proxy to your API.

Leave `TM_CORS_ORIGINS` empty when using rewrites — the browser never talks cross-origin.

---

## Choosing a mode

| Goal | Mode |
|------|------|
| Fork / one-click UI on **your** Vercel or CF | **[fork-deploy.md](fork-deploy.md)** |
| Homelab / VPS / NAS, one URL | **1. Docker** |
| Marketing/demo UI on CDN, users self-host API | **2. CDN + CORS** |
| Global SPA CDN, your hosted API, blank Server field | **3. Edge rewrite** |

Do **not** run the Go + SQLite API on Vercel serverless or Cloudflare Workers for v1 — keep the API on a machine/volume with a real disk.

---

## Checklist

- [ ] Changed `TM_JWT_SECRET` from the default
- [ ] SQLite/attachments on a persistent volume
- [ ] Docker: open the **web** port; Server field blank
- [ ] Split host: `TM_CORS_ORIGINS` matches the SPA origin(s)
- [ ] Uploads: nginx/proxy `client_max_body_size` ≥ API `TM_*_MAX_BYTES` (compose web image uses 20m)
