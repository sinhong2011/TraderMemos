# Changelog

All notable changes to TraderMemos are documented in this file.

Release versioning is managed by [release-please](https://github.com/googleapis/release-please).
See [docs/release.md](docs/release.md) for the release workflow.

## [0.1.6](https://github.com/sinhong2011/TraderMemos/compare/v0.1.5...v0.1.6) (2026-07-30)


### Bug Fixes

* green the Test API and Test web CI jobs ([#10](https://github.com/sinhong2011/TraderMemos/issues/10)) ([f814488](https://github.com/sinhong2011/TraderMemos/commit/f814488b4d3e019d66e718fcbbb9e7787e83ba78))

## [0.1.5](https://github.com/sinhong2011/TraderMemos/compare/v0.1.4...v0.1.5) (2026-07-30)


### Features

* **web:** rebuild the UI on shadcn/ui + coss ui ([#8](https://github.com/sinhong2011/TraderMemos/issues/8)) ([da3f74b](https://github.com/sinhong2011/TraderMemos/commit/da3f74b347344d18ce7caf4dec13d376d6870c77))

## [0.1.4](https://github.com/sinhong2011/TraderMemos/compare/v0.1.3...v0.1.4) (2026-07-23)


### Bug Fixes

* **web:** unblock Cloudflare Workers deploy SPA redirects ([d1d8b9d](https://github.com/sinhong2011/TraderMemos/commit/d1d8b9d933b071080e1a95b2721ab78a1719d94d))

## [0.1.3](https://github.com/sinhong2011/TraderMemos/compare/v0.1.2...v0.1.3) (2026-07-23)


### Bug Fixes

* **ci:** align healthz and settings tests with current behavior ([dcbd6d0](https://github.com/sinhong2011/TraderMemos/commit/dcbd6d0d3e420a0b8f4517658f815f6e57dc240e))

## [0.1.2](https://github.com/sinhong2011/TraderMemos/compare/v0.1.1...v0.1.2) (2026-07-23)


### Features

* **api:** add optional Postgres backend beside SQLite ([2bb1c17](https://github.com/sinhong2011/TraderMemos/commit/2bb1c177bf7adc5b28c832e0df58e405363c7e47))
* **api:** export Call/Put on journal CSV from fill details ([6aace51](https://github.com/sinhong2011/TraderMemos/commit/6aace518dce762c8908a6fdeb808f72851eb8d38))
* **api:** make import preview parse-only and skip orphan journal exits ([bbd9e6b](https://github.com/sinhong2011/TraderMemos/commit/bbd9e6be6677916068a6e571e4016c06b687de90))
* **api:** unify database config on TM_DATABASE_URL ([fc5af2a](https://github.com/sinhong2011/TraderMemos/commit/fc5af2a9f79382e4b9d68445cc65a34eb23ff498))
* **docker:** pull Hub images by default with build override ([49e207a](https://github.com/sinhong2011/TraderMemos/commit/49e207af2706c591c02a29d92aa16669230657f6))
* **web:** add Dir column with LC/LP/SC/SP option tags ([a5e18ce](https://github.com/sinhong2011/TraderMemos/commit/a5e18ce2fccb63b697d3f85b9d3080f75f745646))
* **web:** stage import edits client-side and confirm via /imports/commit ([2f55b80](https://github.com/sinhong2011/TraderMemos/commit/2f55b80050088f58d5f55a74b9ffa5e0beb947f6))


### Bug Fixes

* **api:** expand Postgres slice params for trade delete queries ([eb80105](https://github.com/sinhong2011/TraderMemos/commit/eb80105dd83883715628c5eb384ff2d2e2109d3f))
* **api:** soften option_right partitioning when regrouping fills ([58d9e6f](https://github.com/sinhong2011/TraderMemos/commit/58d9e6f82137e6b1ea226fac20272b2aad6773db))

## [0.1.1](https://github.com/sinhong2011/TraderMemos/compare/v0.1.0...v0.1.1) (2026-07-23)


### Features

* **api:** add media files store and harden trade attachments ([04fc880](https://github.com/sinhong2011/TraderMemos/commit/04fc880862e44cedfc933678baa53dbef07c4539))
* **api:** first-user setup, admin flag, and auth hardening ([26a376d](https://github.com/sinhong2011/TraderMemos/commit/26a376d95459ede55e1b55e36709a5dadf279c12))
* **api:** JSON/CSV export and JSON import ([94d3139](https://github.com/sinhong2011/TraderMemos/commit/94d31391e9f71b93bbf3092048f8d40cd0aa1e2d))
* **api:** LLM trade coach endpoint ([d79bd39](https://github.com/sinhong2011/TraderMemos/commit/d79bd39861b9e8e0b1b6313e2cc7c90c4fcad876))
* **api:** note symbols, checklist content, and note types ([269cdab](https://github.com/sinhong2011/TraderMemos/commit/269cdabd37e6ebe342294406dfb7f0302b6bc64e))
* **api:** personal access tokens (PAT) ([99e935c](https://github.com/sinhong2011/TraderMemos/commit/99e935c28e5cdde9082f55edb02ded31c2870543))
* **api:** seed opening deposits and allow account/cash updates ([d2bd0f9](https://github.com/sinhong2011/TraderMemos/commit/d2bd0f924fee300dc11995c45f37f5dd72b4f785))
* **api:** serve OpenAPI docs ([309bf88](https://github.com/sinhong2011/TraderMemos/commit/309bf888b9786cb44c751693a56da71458149b58))
* **api:** zip account export with attachment files ([fef2a01](https://github.com/sinhong2011/TraderMemos/commit/fef2a01c8b7a940062508b0f9fd3c324e0f216de))
* **web:** add TipTap SignalEditor for markdown notes ([00db118](https://github.com/sinhong2011/TraderMemos/commit/00db118731010c6bf2fa5b7ce16c2e8d7d257fce))
* **web:** extract DayTradesDrawer for calendar and reports ([d749edf](https://github.com/sinhong2011/TraderMemos/commit/d749edfe57c917342f735becbee2287b6e35d00c))
* **web:** Import/Export UI for CSV and JSON ([39baf23](https://github.com/sinhong2011/TraderMemos/commit/39baf23a4d38c71682c59f5a1f71582d509d49f3))
* **web:** media-backed TipTap images, trade gallery, and ZIP export ([4ea2022](https://github.com/sinhong2011/TraderMemos/commit/4ea2022727cb65d4880fcfaaa795e371d2fbeca6))
* **web:** multi-symbol filters and header account switcher ([5840c98](https://github.com/sinhong2011/TraderMemos/commit/5840c9896c14f87d931c7284e1a364a26f22fc1d))
* **web:** Notes page with note and daily-log layouts ([a10063c](https://github.com/sinhong2011/TraderMemos/commit/a10063ca67e60a578cd0393f8999a3e85b7a29bb))
* **web:** polish calendar day hover details ([4dcf0ad](https://github.com/sinhong2011/TraderMemos/commit/4dcf0ada803d8a50a07bc4c499fdb3981c832dd6))
* **web:** Settings API/About tabs and app config ([3cada74](https://github.com/sinhong2011/TraderMemos/commit/3cada74d91a71000bfd8cb08dcc423d2ed42f23c))
* **web:** setup wizard, gated sign-in, and update banner ([421ecce](https://github.com/sinhong2011/TraderMemos/commit/421ecce041d7fe33dbf22a9ece7b14f9ca79159e))
* **web:** TipTap checklist and risk rule defs in Settings ([4ba0225](https://github.com/sinhong2011/TraderMemos/commit/4ba02255679e76ac359e69bf9713b636123f5ab9))


### Bug Fixes

* **api:** recover dirty migrations and stop air racing SQL ([5c03efe](https://github.com/sinhong2011/TraderMemos/commit/5c03efe25b67ded9b4a9ea85b29ac0b7e91d9880))
* **ci:** unbreak web lint and importer fixture tests ([6e09d51](https://github.com/sinhong2011/TraderMemos/commit/6e09d51bf344dca8a0dc0669675fe3fe7bcd3088))
* **web:** soften DataTable pin edges and drop dashboard pin ([5f83040](https://github.com/sinhong2011/TraderMemos/commit/5f830401736d53eee569f6f315ca3fc5c98f547f))
* **web:** stabilize CI unit tests for compact money and tabs ([4f4bf18](https://github.com/sinhong2011/TraderMemos/commit/4f4bf18a7cf8fe64fecd91a6d688dae7888c49c4))
* **web:** stop format fighting TanStack routeTree.gen.ts ([d400924](https://github.com/sinhong2011/TraderMemos/commit/d400924ad8fd0e256b410810ade77c7b5139c3be))

## [0.1.0](https://github.com/sinhong2011/TraderMemos/releases/tag/v0.1.0) (2026-07-22)

### Features

* Go API with SQLite, JWT auth, and trading journal endpoints
* React web app (Signal Terminal UI) with dashboard, trade log, calendar, and reports
* Docker images for self-hosted deployment (`tradermemos-api`, `tradermemos-web`)
* In-app update checks against GitHub Releases
