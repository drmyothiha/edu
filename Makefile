.PHONY: all build run dev test clean kill-port sqlc-generate sqlc migrate-up migrate-down seed tidy help

APP_NAME=edu-api
BIN_DIR=bin
DATABASE_URL ?= postgres://postgres:postgres@localhost:5432/edu_db?sslmode=disable
SQLC ?= $(shell which sqlc 2>/dev/null || echo $(HOME)/go/bin/sqlc)
AIR ?= $(shell which air 2>/dev/null || echo $(HOME)/go/bin/air)

all: build

build:
	@mkdir -p $(BIN_DIR)
	go build -o $(BIN_DIR)/$(APP_NAME) ./cmd/api

run:
	@if [ -x "$(AIR)" ]; then \
		$(AIR); \
	else \
		go run ./cmd/api; \
	fi

dev: run

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
	rm -rf $(BIN_DIR) tmp/

kill-port:
	@echo "Killing process on port 8080..."
	@lsof -ti :8080 | xargs kill -9 2>/dev/null || echo "Port 8080 is already free"


web-install:
	cd web && npm install

web-build:
	cd web && npm run build
	mkdir -p /var/www/edu
	cp -r web/dist/* /var/www/edu/
	chmod -R a+rX /var/www/edu

web-dev:
	cd web && npm run dev

CLOUD_HOST ?= mth@34.21.230.33
CLOUD_PATH ?= /home/mth/edu/

sync:
	@chmod +x ./scripts/sync.sh
	@./scripts/sync.sh

sync-to-cloud:
	@echo "Syncing local changes to cloud server ($(CLOUD_HOST):$(CLOUD_PATH))..."
	rsync -avu --exclude 'node_modules' --exclude 'tmp' --exclude 'bin' --exclude '.DS_Store' --exclude '.env' ./ $(CLOUD_HOST):$(CLOUD_PATH)
	@echo "Sync to cloud complete."

sync-from-cloud:
	@echo "Syncing cloud changes down to local machine..."
	rsync -avu --exclude 'node_modules' --exclude 'tmp' --exclude 'bin' --exclude '.DS_Store' --exclude '.env' $(CLOUD_HOST):$(CLOUD_PATH) ./
	@echo "Sync from cloud complete."

help:
	@echo "Available commands:"
	@echo "  make sync           Two-way sync: downloads cloud edits and uploads local edits"
	@echo "  make sync-to-cloud  Upload local changes to GCP VM (34.21.230.33)"
	@echo "  make sync-from-cloud Pull changes made on GCP VM down to Mac"
	@echo "  make build          Compile API server binary into bin/"
	@echo "  make run            Run API server with air (hot-reload) or go run"
	@echo "  make dev            Alias for make run (hot-reload with air)"
	@echo "  make sqlc-generate  Generate typed Go database code using sqlc"
	@echo "  make migrate-up     Apply schema migrations to PostgreSQL"
	@echo "  make migrate-down   Rollback database schema"
	@echo "  make seed           Seed sample data"
	@echo "  make test           Run tests"
	@echo "  make web-install    Install frontend npm dependencies"
	@echo "  make web-build      Build and deploy web frontend to /var/www/edu"
	@echo "  make web-dev        Run Vite development server"
	@echo "  make tidy           Tidy go.mod dependencies"
	@echo "  make clean          Remove build artifacts"
