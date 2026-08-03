export PATH := $(HOME)/.local/share/pnpm:$(HOME)/go/bin:$(PATH)

.PHONY: help setup setup-mobile dev dev-api dev-web dev-mobile run-ios prebuild-ios rebuild-ios build test test-api test-web lint lint-api lint-web lint-mobile check check-web check-mobile e2e sqlc kill up up-build up-postgres up-postgres-build down logs demo-seed

# Default: show available targets
help: ## List available targets
	@grep -hE '^[a-zA-Z_-]+:.*##' $(MAKEFILE_LIST) | sort | awk 'BEGIN{FS=":.*##"}{printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

## --- setup ---

# Prerequisites: go install github.com/air-verse/air@latest (also done by setup)
setup: ## Install toolchains (mise) + air + web deps; seed api/.env
	mise install
	go install github.com/air-verse/air@latest
	@test -f api/.env || (cp api/.env.example api/.env && echo "Created api/.env from .env.example")
	@./scripts/ensure-pnpm.sh
	cd web && vp install

setup-mobile: ## Install Expo app deps (pnpm, hoisted node_modules for RN)
	@./scripts/ensure-pnpm.sh
	cd mobile && pnpm install

## --- dev ---

dev: ## Run API (air :8080) + web (Vite+ :5173) together
	@trap 'kill 0; wait' INT TERM EXIT; \
	cd api && air & \
	cd web && pnpm run dev & \
	wait

dev-api: ## Run the Go API with air hot reload (:8080)
	cd api && air

dev-web: ## Run the Vite+ dev server (:5173) on all interfaces (--host)
	cd web && pnpm run dev -- --host

# Strip proxy vars for Expo commands: the xray proxy on 127.0.0.1:10808 otherwise leaks
# into the dev-server URLs Expo advertises and breaks simulator connections.
NO_PROXY_ENV := env -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy -u ALL_PROXY -u all_proxy

dev-mobile: ## Run Metro for the mobile dev build (open the TraderMemos app in the simulator)
	cd mobile && $(NO_PROXY_ENV) pnpm start

run-ios: ## Build + install the iOS dev client (needed after native dep / app.json changes)
	cd mobile && $(NO_PROXY_ENV) npx expo run:ios

# `expo prebuild --clean` wipes the hand-applied UIScene adoption (expo/expo#46663) and
# the app would trap at launch — the patch script restores it right after regeneration.
# Never run a bare `expo prebuild --clean`; always go through this target.
prebuild-ios: ## Regenerate ios/ from scratch (prebuild --clean + re-apply UIScene patch)
	cd mobile && $(NO_PROXY_ENV) npx expo prebuild --clean --platform ios
	mobile/scripts/apply-ios-scene-patch.sh

rebuild-ios: prebuild-ios run-ios ## Full native rebuild: clean prebuild, patch, build + install

kill: ## Free API/web ports (air + listeners on 8080/5173)
	@./scripts/release-ports.sh

## --- build ---

build: ## Build api + web
	cd api && go build ./...
	cd web && pnpm run build

## --- test ---

test: test-api test-web ## Run all test suites

test-api: ## Go tests
	cd api && go test ./...

test-web: ## Web unit tests (vitest via Vite+)
	cd web && pnpm run test

e2e: ## Web end-to-end tests (playwright)
	cd web && pnpm run e2e

## --- lint ---

lint: lint-api lint-web lint-mobile ## Lint everything

lint-api: ## go vet
	cd api && go vet ./...

lint-web: ## vp check (oxlint + oxfmt + typecheck)
	cd web && pnpm run lint

lint-mobile: ## eslint via expo lint
	cd mobile && pnpm run lint

check: lint-api check-web check-mobile ## Lint/typecheck everything

check-web: ## Vite+ check for web
	cd web && pnpm run check

check-mobile: ## tsc typecheck for the Expo app
	cd mobile && pnpm run check

## --- codegen ---

sqlc: ## Regenerate sqlc code
	cd api && sqlc generate

## --- docker ---

up: ## Start stack from Docker Hub images (SQLite)
	docker compose up -d

up-build: ## Build images from source, then start (SQLite)
	docker compose -f docker-compose.yml -f docker-compose.build.yml up --build -d

up-postgres: ## Hub images + Postgres overlay
	docker compose -f docker-compose.yml -f docker-compose.postgres.yml up -d

up-postgres-build: ## Build from source + Postgres overlay
	docker compose -f docker-compose.yml -f docker-compose.build.yml -f docker-compose.postgres.yml up --build -d

down: ## Stop docker compose stack
	docker compose down

logs: ## Tail docker compose logs
	docker compose logs -f

## --- demo ---

# Seeds ~200 generated trades over the last ~3 months through the public API.
# Override API/EMAIL/PASSWORD for a deployed instance, e.g.
#   make demo-seed API=https://demo.example.com/api/v1 EMAIL=demo@example.com PASSWORD=…
API      ?= http://localhost:3000/api/v1
EMAIL    ?= demo@example.com
PASSWORD ?= demo-password-change-me

demo-seed: ## Seed an instance with the demo dataset (API/EMAIL/PASSWORD overridable)
	python3 scripts/seed-demo.py --api "$(API)" --email "$(EMAIL)" --password "$(PASSWORD)"
