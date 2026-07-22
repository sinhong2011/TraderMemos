<div align="center">

# TraderMemos

**Self-hosted trading journal** — Go API + React web (Signal Terminal)

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

## Get Started

1. Click a **Deploy** button above — web UI on **your** Vercel / Cloudflare / Netlify, or **API** on Railway (see below).
2. Run the API (Railway button, Docker/`make up`, or a VPS):
   ```bash
   make up   # local all-in-one
   ```
3. Allow your CDN origin on the API:
   ```bash
   TM_CORS_ORIGINS=https://*.vercel.app,https://*.pages.dev,https://*.workers.dev,https://*.netlify.app,https://*.up.railway.app,http://localhost:5173
   ```
4. Open the web app → leave **Server** blank only for same-origin Docker; otherwise enter your API URL (or set `VITE_API` at build time).

| Button | Deploys |
|--------|---------|
| Vercel / Cloudflare / Netlify | Web SPA (`web/`) |
| Railway | Go API ([`railway.toml`](railway.toml) → `api/Dockerfile`) — attach a Volume at `/data` |

> CDN hosts the **web UI**. Railway/Docker hosts the **API** (SQLite + uploads).

Already forked? Import your fork → Root **`web`** (Vercel/CF) or [`netlify.toml`](netlify.toml) / [`railway.toml`](railway.toml). Details: [docs/fork-deploy.md](docs/fork-deploy.md).

## Docker all-in-one

```bash
make setup && make up   # http://localhost:3000  (SPA + /api proxy)
```

Same-origin `/api` — no CORS, blank Server field.

## Docs

| Doc | Topic |
|-----|--------|
| [docs/fork-deploy.md](docs/fork-deploy.md) | One-click / fork → Vercel, Cloudflare, Netlify, Railway |
| [docs/deploy.md](docs/deploy.md) | Docker, CORS, edge rewrite |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Local dev (`make dev`) |
| [DESIGN.md](DESIGN.md) | Signal Terminal UI system |
