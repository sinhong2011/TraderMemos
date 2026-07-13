export PATH := $(HOME)/.bun/bin:$(HOME)/go/bin:$(PATH)

.PHONY: help setup dev dev-api dev-web build test test-api test-web lint lint-api lint-web e2e sqlc kill up down logs

# Default: show available targets
help: ## List available targets
	@grep -hE '^[a-zA-Z_-]+:.*##' $(MAKEFILE_LIST) | sort | awk 'BEGIN{FS=":.*##"}{printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

## --- setup ---

# Prerequisites: go install github.com/air-verse/air@latest (also done by setup)
setup: ## Install toolchains (mise) + air + web deps; seed api/.env
	mise install
	go install github.com/air-verse/air@latest
	@test -f api/.env || (cp api/.env.example api/.env && echo "Created api/.env from .env.example")
	@./scripts/ensure-bun.sh
	cd web && bun install

## --- dev ---

dev: ## Run API (air :8080) + web (vite :5173) together
	@trap 'kill 0; wait' INT TERM EXIT; \
	cd api && air & \
	cd web && bun run dev & \
	wait

dev-api: ## Run the Go API with air hot reload (:8080)
	cd api && air

dev-web: ## Run the Vite web dev server (:5173)
	cd web && bun run dev

kill: ## Free API/web ports (air + listeners on 8080/5173)
	@./scripts/release-ports.sh

## --- build ---

build: ## Build api + web
	cd api && go build ./...
	cd web && bun run build

## --- test ---

test: test-api test-web ## Run all test suites

test-api: ## Go tests
	cd api && go test ./...

test-web: ## Web unit tests (vitest)
	cd web && bun run test

e2e: ## Web end-to-end tests (playwright)
	cd web && bun run e2e

## --- lint ---

lint: lint-api lint-web ## Lint everything

lint-api: ## go vet
	cd api && go vet ./...

lint-web: ## biome check
	cd web && bun run lint

## --- codegen ---

sqlc: ## Regenerate sqlc code
	cd api && sqlc generate

## --- docker ---

up: ## Start full stack via docker compose
	docker compose up --build -d

down: ## Stop docker compose stack
	docker compose down

logs: ## Tail docker compose logs
	docker compose logs -f
