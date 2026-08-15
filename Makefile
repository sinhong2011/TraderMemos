export PATH := $(HOME)/.local/share/pnpm:$(HOME)/go/bin:$(PATH)

.PHONY: help setup setup-mobile dev dev-api dev-web dev-mobile run-ios prebuild-ios rebuild-ios run-android prebuild-android rebuild-android doctor-android build test test-api test-web lint lint-api lint-web lint-mobile check check-web check-mobile e2e eas-build-dev eas-build-preview eas-build-ios eas-submit-ios eas-build-android eas-submit-android sqlc kill up up-build up-postgres up-postgres-build down logs demo-seed

# Default: show available targets
help: ## List available targets
	@grep -hE '^[a-zA-Z_-]+:.*##' $(MAKEFILE_LIST) | sort | awk 'BEGIN{FS=":.*##"}{printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

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

# UIScene adoption (expo/expo#46663) is applied by the with-ios-scene-lifecycle config
# plugin, so a bare `expo prebuild --clean` is now safe. The script below re-runs as a
# no-op belt-and-braces check that the plugin actually landed the patch.
prebuild-ios: ## Regenerate ios/ from scratch (prebuild --clean + verify UIScene patch)
	cd mobile && $(NO_PROXY_ENV) npx expo prebuild --clean --platform ios
	mobile/scripts/apply-ios-scene-patch.sh

rebuild-ios: prebuild-ios run-ios ## Full native rebuild: clean prebuild, patch, build + install

# Android Studio ships the JDK Gradle needs, but only the IDE knows where it is —
# a bare shell has no `java`. Point JAVA_HOME at the bundled JetBrains Runtime and
# ANDROID_HOME at the SDK the IDE's SDK Manager installs. Override either on the
# command line if you keep them elsewhere.
#
# JetBrains Toolbox installs into ~/Applications; a direct download lands in
# /Applications. Take whichever exists, preferring the Toolbox copy.
ANDROID_STUDIO ?= $(firstword $(wildcard $(HOME)/Applications/Android*Studio*.app) $(wildcard /Applications/Android*Studio*.app))
JAVA_HOME ?= $(ANDROID_STUDIO)/Contents/jbr/Contents/Home
ANDROID_HOME ?= $(HOME)/Library/Android/sdk
ANDROID_ENV := JAVA_HOME="$(JAVA_HOME)" ANDROID_HOME="$(ANDROID_HOME)" PATH="$(JAVA_HOME)/bin:$(ANDROID_HOME)/platform-tools:$(PATH)"

doctor-android: ## Verify the Android toolchain (JDK, SDK, adb, emulators)
	@echo "JAVA_HOME   $(JAVA_HOME)"
	@test -x "$(JAVA_HOME)/bin/java" || (echo "  ✗ no java here — install Android Studio, or set JAVA_HOME=<jdk>"; exit 1)
	@"$(JAVA_HOME)/bin/java" -version 2>&1 | sed 's/^/  ✓ /'
	@echo "ANDROID_HOME $(ANDROID_HOME)"
	@test -d "$(ANDROID_HOME)/platform-tools" || (echo "  ✗ no SDK — open Android Studio ▸ SDK Manager and install the platform + tools"; exit 1)
	@echo "  ✓ platform-tools present"
	@echo "installed platforms:"; ls "$(ANDROID_HOME)/platforms" 2>/dev/null | sed 's/^/  /' || echo "  (none)"
	@echo "devices:"; "$(ANDROID_HOME)/platform-tools/adb" devices | tail -n +2 | sed 's/^/  /'

run-android: ## Build + install the Android dev client on the running emulator/device
	cd mobile && $(NO_PROXY_ENV) $(ANDROID_ENV) npx expo run:android

prebuild-android: ## Regenerate android/ from scratch
	cd mobile && $(NO_PROXY_ENV) npx expo prebuild --clean --platform android

rebuild-android: prebuild-android run-android ## Full native rebuild: clean prebuild, build + install

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

check-mobile: ## tsc typecheck + icon-map check for the Expo app
	cd mobile && pnpm run check
	cd mobile && pnpm run check-icons

## --- eas ---

# Cloud builds on EAS. One-time setup: `cd mobile && npx eas-cli login && npx eas-cli init`,
# then `npx eas-cli credentials` for the signing assets and the ASC API key.
# CI does the same thing via .github/workflows/mobile-eas.yml.

eas-build-dev: ## EAS: simulator dev-client build (development profile)
	cd mobile && npx eas-cli build --platform ios --profile development

eas-build-preview: ## EAS: internal-distribution build (preview profile)
	cd mobile && npx eas-cli build --platform ios --profile preview

eas-build-ios: ## EAS: store build (production profile, no submit)
	cd mobile && npx eas-cli build --platform ios --profile production

eas-submit-ios: ## EAS: submit the latest production build to App Store Connect
	cd mobile && npx eas-cli submit --platform ios --profile production --latest

eas-build-android: ## EAS: store build (production profile, no submit)
	cd mobile && npx eas-cli build --platform android --profile production

eas-submit-android: ## EAS: submit the latest production build to Google Play
	cd mobile && npx eas-cli submit --platform android --profile production --latest

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
