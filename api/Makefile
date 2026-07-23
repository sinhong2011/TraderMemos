.PHONY: build test run sqlc migrate
build:
	go build ./...
test:
	go test ./...
run:
	go run ./cmd/server
sqlc:
	python3 scripts/convert_queries_pg.py
	sqlc generate
	python3 scripts/gen_pg_adapter.py
