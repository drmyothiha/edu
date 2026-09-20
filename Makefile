.PHONY: all build run test clean sqlc-generate sqlc migrate-up migrate-down seed tidy help

APP_NAME=edu-api
BIN_DIR=bin
DATABASE_URL ?= postgres://postgres:postgres@localhost:5432/edu_db?sslmode=disable
SQLC ?= $(shell which sqlc 2>/dev/null || echo $(HOME)/go/bin/sqlc)

all: build

build:
	@mkdir -p $(BIN_DIR)
	go build -o $(BIN_DIR)/$(APP_NAME) ./cmd/api

run:
	go run ./cmd/api

sqlc-generate:
	@if [ ! -x "$(SQLC)" ]; then \
		echo "sqlc binary not found at $(SQLC), installing..."; \
		go install github.com/sqlc-dev/sqlc/cmd/sqlc@v1.28.0; \
	fi
	$(SQLC) generate

sqlc: sqlc-generate

migrate-up:
	@echo "Applying schema migrations to $(DATABASE_URL)..."
	@if command -v psql >/dev/null 2>&1; then \
		psql "$(DATABASE_URL)" -f db/migrations/000001_init_schema.up.sql; \
	else \
		echo "psql not found; running with AUTO_MIGRATE=true"; \
		AUTO_MIGRATE=true go run ./cmd/api; \
	fi

migrate-down:
	@echo "Rolling back schema..."
	@psql "$(DATABASE_URL)" -f db/migrations/000001_init_schema.down.sql

seed:
	@echo "Seeding database with sample data..."
	go run ./cmd/seed

test:
	go test -v ./...

tidy:
	go mod tidy

clean:
	rm -rf $(BIN_DIR)

help:
	@echo "Available commands:"
	@echo "  make build          Compile API server binary into bin/"
	@echo "  make run            Run API server locally"
	@echo "  make sqlc-generate  Generate typed Go database code using sqlc"
	@echo "  make migrate-up     Apply schema migrations to PostgreSQL"
	@echo "  make migrate-down   Rollback database schema"
	@echo "  make test           Run tests"
	@echo "  make tidy           Tidy go.mod dependencies"
	@echo "  make clean          Remove build artifacts"
