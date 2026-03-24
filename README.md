# MeRenta

Peer-to-peer rental marketplace. Full-stack web application developed as a Software Engineering II project at the
University of León.

## Description

MeRenta allows individual users to list products for rent and rent products from other users. It includes rental
management with a state machine, Stripe payments, a ratings system, internal messaging, insurance policies, and an
administration panel.

## Tech Stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS
- **Backend:** Go
- **Database:** PostgreSQL, Supabase
- **Testing:** Vitest, Go testing, Playwright
- **CI/CD:** GitHub Actions, Render.com
- **Other:** Stripe (payments), JWT (authentication), Docker

## Project Structure

```
├── backend/                Go API server
│   ├── cmd/server/         Entry point
│   └── internal/           Internal code (config, handlers, services...)
│
├── frontend/               React + TypeScript + Vite + Tailwind
│   └── src/
│
├── e2e/                    E2E tests with Playwright
├── docs/                   Documentation and ADRs
├── .github/workflows/      CI/CD pipelines
└── Makefile                Centralized commands
```

## Prerequisites

- [Go](https://go.dev/dl/) 1.24+
- [Node.js](https://nodejs.org/) 22+

## Getting Started

```bash
make install

# Terminal 1
make run-backend    # port 8080

# Terminal 2
make run-frontend   # port 5173
```

The Vite dev server proxies `/api` requests to the backend.

## Available Commands

### Development

| Command             | Description                              |
|---------------------|------------------------------------------|
| `make install`      | Install all dependencies and tools       |
| `make run-backend`  | Backend with hot reload (Air)            |
| `make run-frontend` | Frontend dev server (Vite)               |
| `make run`          | Both in parallel (`make -j2 run`)        |

### Build

| Command               | Description               |
|-----------------------|---------------------------|
| `make build-backend`  | Compile backend binary    |
| `make build-frontend` | Production frontend build |
| `make build`          | Build everything          |

### Testing

| Command              | Description                        |
|----------------------|------------------------------------|
| `make test`          | Run all tests                      |
| `make test-backend`  | Backend tests                      |
| `make test-frontend` | Frontend tests                     |
| `make test-coverage` | Backend tests with coverage report |
| `make e2e`           | E2E tests with Playwright          |

### Code Quality

| Command      | Description                  |
|--------------|------------------------------|
| `make lint`  | Run all linters              |
| `make fmt`   | Format all code              |
| `make check` | Lint + tests (pre-push / CI) |

## Configuration

Copy `.env.example` to `.env` and adjust the variables:
`cp .env.example .env`

## Documentation

- [Getting Started Guide](docs/getting-started.md)
- [Technical Decisions (ADRs)](docs/adr/)

## Authors

Jose Ángel Mestas Díaz  
Elena Ondicol García  
Diego Pérez González  
Lucía González Rodríguez
