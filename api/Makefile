.PHONY: build test run sqlc migrate
build:
	go build ./...
test:
	go test ./...
run:
	go run ./cmd/server
sqlc:
	sqlc generate
