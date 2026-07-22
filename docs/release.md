# Release workflow

TraderMemos uses [release-please](https://github.com/googleapis/release-please) for semver, changelogs, and GitHub Releases.

## Day to day

1. Merge PRs to `main` with **Conventional Commit** titles (squash-merge recommended).
2. release-please opens or updates a **Release PR** (`chore: release X.Y.Z`).
3. Review the changelog and version bumps (`VERSION`, `web/package.json`, `CHANGELOG.md`).
4. Merge the Release PR → GitHub Release `vX.Y.Z` is created and Docker images are published.

## Commit messages

| Prefix | Semver bump (pre-1.0) | Example |
|--------|----------------------|---------|
| `fix:` | patch | `fix: healthz version lookup` |
| `feat:` | patch | `feat: about tab updates section` |
| `feat!:` / `fix!:` + `BREAKING CHANGE:` | major | `feat!: remove legacy import API` |
| `chore:`, `docs:`, `refactor:` | none | `chore: bump vite` |

Pre-1.0, `feat:` bumps **patch** (`0.1.0` → `0.1.1`) via `bump-patch-for-minor-pre-major`.

### Force a version

Add to the squash-merge commit body:

```text
Release-As: 0.2.0
```

## Version files

| File | Purpose |
|------|---------|
| `VERSION` | Source of truth for API + web builds |
| `web/package.json` | Kept in sync by release-please |
| `CHANGELOG.md` | Human-readable release notes |
| `.release-please-manifest.json` | Last released version (managed by release-please) |

## Docker images

On release, `.github/workflows/release-please.yml` chains `docker-publish.yml` with the new version (same tags as a manual GitHub Release).

You can still run **Publish Docker images** manually via `workflow_dispatch`.

## Bootstrap note

`release-please-config.json` includes `bootstrap-sha` so the first automated release only includes commits **after** release-please was added. Remove that key after the first merged Release PR.
