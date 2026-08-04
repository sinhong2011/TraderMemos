# Security Policy

TraderMemos is a self-hosted application that stores personal trading and financial data.
We take vulnerability reports seriously.

## Supported versions

Only the latest release receives security fixes. Pin `TM_IMAGE_TAG` in production and
upgrade promptly when a release lands — migrations run automatically on boot.

## Reporting a vulnerability

**Please do not open a public issue for security reports.**

Use GitHub's private vulnerability reporting:
[Security → Report a vulnerability](https://github.com/sinhong2011/TraderMemos/security/advisories/new).

Include what you can: affected version (`GET /healthz` shows it), deployment mode
(Docker all-in-one, split CDN + API), reproduction steps, and impact. You'll get an
acknowledgement within a few days; fixes ship as a normal patch release with credit
unless you prefer otherwise.

## Hardening a deployment

The defaults are safe for `localhost`; for anything public, the short list:

- Set a real `TM_JWT_SECRET` (`openssl rand -hex 32`) and remove `TM_ALLOW_INSECURE_JWT`
- Terminate TLS in front (Caddy/Traefik/nginx) and expose only the web port
- Keep `TM_ALLOW_REGISTRATION=false` unless you mean to open it
- Treat personal access tokens (`tm_pat_…`) like passwords — they carry full account access

See the deploy checklist in `marketing/content/docs/self-hosting/deploy.mdx` for the full list.
