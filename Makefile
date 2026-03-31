GOPATH := $(shell go env GOPATH)
BACKEND_BIN := backend/bin/server

.PHONY: install install-backend install-frontend install-e2e clean \
        run-backend run-frontend run \
        build-backend build-frontend build \
        run-backend-prod run-frontend-prod \
        test test-backend test-frontend test-coverage \
        lint lint-backend lint-frontend \
        e2e \
        fmt fmt-backend fmt-frontend \
        check \
        seed migrate-up migrate-down migrate-create

# ============================================================================
# INSTALL
# ============================================================================

## Install backend dependencies and tools
install-backend:
	go install github.com/air-verse/air@latest
	curl -sSfL https://raw.githubusercontent.com/golangci/golangci-lint/HEAD/install.sh | sh -s -- -b $(GOPATH)/bin
	go mod download

## Install frontend dependencies
install-frontend:
	cd frontend && npm ci

## Install E2E dependencies and browsers
install-e2e: install-backend install-frontend
	cd e2e && npm ci
	cd e2e && npx playwright install --with-deps

## Install all dependencies and tools
install: install-backend install-frontend

# ============================================================================
# CLEAN
# ============================================================================

## Clean all build artifacts
clean:
	rm -fr frontend/dist
	rm -fr $(BACKEND_BIN)
	rm -fr e2e/playwright-report
	rm -fr e2e/test-results

# ============================================================================
# DEVELOPMENT
# ============================================================================

## Run backend with hot reload
run-backend:
	$(GOPATH)/bin/air -c backend/.air.toml

## Run frontend dev server
run-frontend:
	cd frontend && npm run dev

## Run both backend and frontend (requires 'make -j2 run' or two terminals)
run: run-backend run-frontend

# ============================================================================
# BUILD
# ============================================================================

## Build backend binary
build-backend:
	CGO_ENABLED=0 go build -o $(BACKEND_BIN) ./backend/cmd/server

## Build frontend for production
build-frontend:
	cd frontend && npm run build

## Build everything
build: build-backend build-frontend

# ============================================================================
# PRODUCTION
# ============================================================================

## Run production backend
run-backend-prod: build-backend
	./$(BACKEND_BIN)

## Run production frontend preview
run-frontend-prod: build-frontend
	cd frontend && npm run preview

# ============================================================================
# TEST
# ============================================================================

## Run backend tests
test-backend:
	go test -v -race -count=1 ./...

## Run frontend tests
test-frontend:
	cd frontend && npm run test

## Run backend tests with coverage
test-coverage:
	go test -v -race -count=1 -coverprofile=coverage.out -covermode=atomic ./...
	go tool cover -func=coverage.out

## Run all tests
test: test-backend test-frontend

# ============================================================================
# LINT & FORMAT
# ============================================================================

## Lint backend
lint-backend:
	$(GOPATH)/bin/golangci-lint run ./backend/...

## Lint frontend
lint-frontend:
	cd frontend && npm run lint

## Lint everything
lint: lint-backend lint-frontend

## Format backend
fmt-backend:
	go fmt ./...

## Format frontend
fmt-frontend:
	cd frontend && npx prettier --write "src/**/*.{ts,tsx,css}"

## Format everything
fmt: fmt-backend fmt-frontend

# ============================================================================
# E2E
# ============================================================================

## Run E2E tests (requires backend + frontend running)
e2e:
	cd e2e && npx playwright test

# ============================================================================
# CI / PRE-PUSH CHECK
# ============================================================================

## Run all checks (lint + test) — use in CI or before pushing
check: lint test