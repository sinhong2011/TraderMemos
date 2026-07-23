# Fork → deploy the web UI on your account

Goal: another GitHub user gets **TraderMemos web** on **their** Vercel / Cloudflare / Netlify, and/or the **API** on Railway, then connects them.

```
You                    CDN (Vercel / CF / Netlify)     API (Railway / Docker)
├─ one-click web ───► SPA                     ──CORS──► Go + SQLite volume
└─ login “Server” = https://your-api.up.railway.app
```

---

## Path A — One-click (easiest)

No manual fork. The platform clones into *your* GitHub and deploys under *your* account.

| Platform | Button / link | What you get |
|----------|---------------|--------------|
| **Vercel** | [Deploy with Vercel](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fsinhong2011%2FTraderMemos&root-directory=web&project-name=tradermemos&repository-name=tradermemos&env=VITE_API&envDescription=Optional%20API%20base%20URL%20(e.g.%20https%3A%2F%2Fapi.example.com%2Fapi%2Fv1).%20Leave%20empty%20to%20set%20Server%20at%20login.&envLink=https%3A%2F%2Fgithub.com%2Fsinhong2011%2FTraderMemos%2Fblob%2Fmain%2Fdocs%2Ffork-deploy.md) | Full monorepo clone; project Root = `web` |
| **Cloudflare** | [Deploy to Cloudflare](https://deploy.workers.cloudflare.com/?url=https%3A%2F%2Fgithub.com%2Fsinhong2011%2FTraderMemos%2Ftree%2Fmain%2Fweb) | New repo from `web/` only; Workers static SPA |
| **Netlify** | [Deploy to Netlify](https://app.netlify.com/start/deploy?repository=https://github.com/sinhong2011/TraderMemos) | Uses root [`netlify.toml`](../netlify.toml) (`base = web`) |
| **Railway** | [Deploy on Railway](https://railway.com/new/template?template=https%3A%2F%2Fgithub.com%2Fsinhong2011%2FTraderMemos&utm_medium=integration&utm_source=button&utm_campaign=tradermemos) | Go API via [`railway.toml`](../railway.toml); attach Volume at `/data` |

Optional env **`VITE_API`**: bake in a default API base (`https://api.example.com/api/v1`). Leave blank to type the Server URL at login.

---

## Path B — You already forked

Use this when you clicked **Fork** on GitHub and want continuous deploys from *your* fork.

### Vercel

1. Open [vercel.com/new](https://vercel.com/new) → **Import** your fork (`youruser/TraderMemos`).
2. Set **Root Directory** to `web` (important).
3. Leave build settings alone — [`web/vercel.json`](../web/vercel.json) supplies install/build/output + SPA rewrites.
4. Optional: Environment Variable `VITE_API`.
5. Deploy. Later pushes to your default branch redeploy automatically.

### Cloudflare

**Option 1 — Workers (matches one-click config)**  
1. [Deploy to Cloudflare](https://deploy.workers.cloudflare.com/?url=https%3A%2F%2Fgithub.com%2FYOURUSER%2FTraderMemos%2Ftree%2Fmain%2Fweb) — replace `YOURUSER`, or connect the `web/` app in the dashboard.  
2. Uses [`web/wrangler.toml`](../web/wrangler.toml) (`assets` + SPA `not_found_handling`).

**Option 2 — Pages Connect to Git**  
| Setting | Value |
|---------|--------|
| Repository | your fork |
| Root directory | `web` |
| Build command | `bun run build` |
| Output directory | `dist` |
| Env (optional) | `VITE_API` |

SPA fallback: `web/public/_redirects`.

### Netlify

1. [app.netlify.com/start/deploy](https://app.netlify.com/start/deploy?repository=https://github.com/sinhong2011/TraderMemos) — or **Add new site → Import** your fork.  
2. Root [`netlify.toml`](../netlify.toml) already sets `base = web`, build, publish, and SPA redirect.  
3. Optional env: `VITE_API`.  
4. Allow `https://*.netlify.app` in `TM_CORS_ORIGINS`.

### Railway (API)

Railway is the best one-click host for the **Go API** (disk volume for SQLite). Pair it with a CDN web deploy above.

1. [Deploy on Railway](https://railway.com/new/template?template=https%3A%2F%2Fgithub.com%2Fsinhong2011%2FTraderMemos&utm_medium=integration&utm_source=button&utm_campaign=tradermemos) — or New Project → Deploy from GitHub → your fork.  
2. Root [`railway.toml`](../railway.toml) builds `api/Dockerfile` and health-checks `/healthz`.  
3. **Attach a Volume** mounted at `/data` (keeps SQLite + attachments across deploys).  
4. Variables:
   | Variable | Notes |
   |----------|--------|
   | `TM_JWT_SECRET` | Required — generate with `openssl rand -hex 32` |
   | `TM_CORS_ORIGINS` | e.g. `https://*.vercel.app,https://*.netlify.app` |
   | `TM_DATABASE_URL` | Default `sqlite:///data/tradermemos.db` (matches Dockerfile); legacy `TM_DB_PATH` still works |
5. Generate a public domain (`*.up.railway.app`) → use that as login **Server** / `VITE_API`.  
6. `PORT` is honored automatically when `TM_HTTP_PORT` is unset.

---

## Path C — Point the UI at your API

The CDN only hosts the SPA. Your journal data stays on a host you control.

```bash
# On the API host (Docker / binary)
TM_JWT_SECRET=$(openssl rand -hex 32)
TM_CORS_ORIGINS=https://*.vercel.app,https://*.pages.dev,https://*.workers.dev,https://*.netlify.app,https://*.up.railway.app,http://localhost:5173
# add your custom domain exactly, e.g. https://journal.example.com
```

Then either:

- Leave `VITE_API` empty → open the site → **Server** = `https://api.your.domain` (or full `.../api/v1`), or  
- Set `VITE_API=https://api.your.domain/api/v1` on the CDN project and redeploy.

API Docker / compose: see [deploy.md](deploy.md).

---

## Checklist for fork deployers

- [ ] UI live on your Vercel, Cloudflare, or Netlify account  
- [ ] API running (Railway / Docker / VPS) with a public HTTPS URL and persistent SQLite volume  
- [ ] `TM_CORS_ORIGINS` includes your CDN host pattern (or exact custom domain)  
- [ ] Login works with **Server** set (or `VITE_API` baked in)  
- [ ] Changed `TM_JWT_SECRET` from the default  

---

## Why not put the API on Vercel/Workers?

The API is Go + SQLite + uploads. Keep it on Docker/VPS/NAS. The one-click buttons are **web-only** by design.

---

## Maintainer tip (upstream)

In GitHub → **Settings → General → Template repository**, enable the template flag so “Use this template” appears next to Fork. One-click Deploy buttons already clone without requiring a template.
