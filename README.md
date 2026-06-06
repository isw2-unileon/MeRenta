# MeRenta

MeRenta is a full-stack web application for peer-to-peer product rentals, developed as a Software Engineering II project at the University of León.

## Description

The platform allows users to publish products for rent, search available items, book them, manage payments, and communicate with other users. It also includes profiles, reviews, favorites, incident reporting, user verification, and an administration panel to operate the platform.

## Features

- User registration, login, and JWT authentication.
- Catalog with search, categories, favorites, and product detail pages.
- Product creation, editing, and withdrawal.
- Bookings with calendar support, history, and rental states.
- Stripe payments.
- Internal chat with WebSockets and encrypted messages.
- User reviews.
- Incident management for products, bookings, and users.
- Admin panel for users, products, payments, operations, verifications, and audit logs.

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS 4, React Router, Vitest.
- **Backend:** Go 1.25, Gin, pgx, sqlc, WebSockets.
- **Database:** PostgreSQL and Supabase.
- **Payments:** Stripe.
- **Testing:** Go test, Vitest, and Playwright.
- **Quality:** golangci-lint, ESLint, Prettier, and react-doctor.
- **CI/CD:** GitHub Actions and Render.

## Project Structure

```text
.
|-- backend/                 Go API
|   |-- cmd/server/          Server entry point
|   |-- internal/            Config, handlers, services, models, and SQLC
|   |-- pkg/                 Reusable packages
|   `-- test/integration/    Integration tests
|-- frontend/                React + TypeScript + Vite app
|   |-- public/              Public assets
|   `-- src/                 Pages, components, hooks, types, and routes
|-- e2e/                     End-to-end tests with Playwright
|-- docs/                    Documentation and ADRs
|-- .github/workflows/       CI pipelines
|-- Makefile                 Development commands
|-- go.mod                   Go module
`-- .env.example             Configuration template
```

## Requirements

- [Go](https://go.dev/dl/) 1.25 or later.
- [Node.js](https://nodejs.org/) 22 or later.
- PostgreSQL or a configured Supabase project.
- Stripe account and keys for payment testing.
- Docker to run local database integration tests.

## Configuration

Copy the environment variable template:

```bash
cp .env.example .env
```

Main variables:

| Variable                      | Purpose                                      |
|-------------------------------|----------------------------------------------|
| `PORT`                        | Backend port.                                |
| `GIN_MODE`                    | Gin mode, for example `debug` or `release`.  |
| `CORS_ALLOW_ORIGIN`           | Allowed frontend origin.                     |
| `DATABASE_URL`                | PostgreSQL connection URL.                   |
| `SUPABASE_URL`                | Supabase project URL.                        |
| `SUPABASE_SERVICE_ROLE_KEY`   | Supabase service role key.                   |
| `JWT_SECRET`                  | Base64 secret used to sign JWT tokens.       |
| `MESSAGE_ENCRYPTION_KEY`      | Base64 key used to encrypt messages.         |
| `STRIPE_SECRET_KEY`           | Stripe secret key.                           |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key used by the frontend. |
| `VITE_API_BASE_URL`           | Backend URL used by Vite and the app.        |

In local development, the backend usually runs at `http://localhost:8080` and the frontend at `http://localhost:5173`.

## Installation

Install development dependencies and tools:

```bash
make install-dev
```

For a production dependency install:

```bash
make install-prod
```

## Local Development

Start the backend:

```bash
make run-backend
```

Start the frontend in another terminal:

```bash
make run-frontend
```

Open `http://localhost:5173`. The Vite server proxies `/api`, `/health`, and `/ready` to the backend configured in `VITE_API_BASE_URL`.

Both processes can also be started with:

```bash
make -j2 run
```

## Available Commands

### Development

| Command             | Description                                 |
|---------------------|---------------------------------------------|
| `make install-dev`  | Install development dependencies and tools. |
| `make install-prod` | Install production dependencies.            |
| `make run-backend`  | Run the backend with Air hot reload.        |
| `make run-frontend` | Run the Vite development server.            |
| `make -j2 run`      | Run backend and frontend in parallel.       |
| `make sqlc`         | Regenerate Go code from SQL queries.        |

### Build

| Command                  | Description                          |
|--------------------------|--------------------------------------|
| `make build-backend`     | Compile the backend binary.          |
| `make build-frontend`    | Build the production frontend.       |
| `make build`             | Build backend and frontend.          |
| `make run-backend-prod`  | Run the compiled backend.            |
| `make run-frontend-prod` | Run the production frontend preview. |

### Tests

| Command                        | Description                                                        |
|--------------------------------|--------------------------------------------------------------------|
| `make test`                    | Run backend and frontend tests.                                    |
| `make test-backend`            | Run backend tests.                                                 |
| `make test-backend-race`       | Run Go tests with the race detector.                               |
| `make test-frontend`           | Run frontend tests with Vitest.                                    |
| `make test-frontend-coverage`  | Run frontend test coverage.                                        |
| `make test-backend-coverage`   | Run backend test coverage.                                         |
| `make test-coverage`           | Run frontend and backend coverage.                                 |
| `make test-integration-docker` | Run integration tests with PostgreSQL in Docker.                   |
| `make e2e`                     | Run Playwright tests. Requires backend and frontend to be running. |

### Quality

| Command             | Description                                        |
|---------------------|----------------------------------------------------|
| `make fmt`          | Format backend and frontend code.                  |
| `make format-check` | Check formatting.                                  |
| `make lint`         | Run linters.                                       |
| `make doctor`       | Run React diagnostics.                             |
| `make check`        | Run tests, formatting checks, linting, and doctor. |
| `make clean`        | Remove build artifacts and temporary reports.      |

## Documentation

- [Getting started guide](docs/getting-started.md)
- [Go best practices](docs/golang.md)
- [Technical decisions](docs/adr/)
- [Monorepo structure](docs/monorepo.md)

## Authors

- Elena Ondicol García
- Diego Pérez González
- José Ángel Mestas Díaz
- Lucía González Rodríguez
