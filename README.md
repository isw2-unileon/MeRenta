# MeRenta

MeRenta es una aplicacion web full-stack para alquiler de productos entre particulares, desarrollada como proyecto de Ingenieria del Software II en la Universidad de Leon.

## Descripcion

La plataforma permite publicar productos en alquiler, buscar articulos disponibles, reservarlos, gestionar pagos y comunicarse con otros usuarios. Tambien incluye perfiles, valoraciones, favoritos, incidencias, verificacion de usuarios y un panel de administracion para operar la plataforma.

## Funcionalidades

- Registro, inicio de sesion y autenticacion con JWT.
- Catalogo con busqueda, categorias, favoritos y detalle de producto.
- Creacion, edicion y retirada de productos.
- Reservas con calendario, historial y estados de alquiler.
- Pagos mediante Stripe.
- Chat interno con WebSockets y cifrado de mensajes.
- Resenas entre usuarios.
- Gestion de incidencias sobre productos, reservas y usuarios.
- Panel de administracion con usuarios, productos, pagos, operaciones, verificaciones y auditoria.

## Stack Tecnologico

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS 4, React Router, Vitest.
- **Backend:** Go 1.25, Gin, pgx, sqlc, WebSockets.
- **Base de datos:** PostgreSQL y Supabase.
- **Pagos:** Stripe.
- **Testing:** Go test, Vitest y Playwright.
- **Calidad:** golangci-lint, ESLint, Prettier y react-doctor.
- **CI/CD:** GitHub Actions y Render.

## Estructura del Proyecto

```text
.
|-- backend/                 API en Go
|   |-- cmd/server/          Punto de entrada del servidor
|   |-- internal/            Configuracion, handlers, servicios, modelos y SQLC
|   |-- pkg/                 Paquetes reutilizables
|   `-- test/integration/    Tests de integracion
|-- frontend/                Aplicacion React + TypeScript + Vite
|   |-- public/              Assets publicos
|   `-- src/                 Paginas, componentes, hooks, tipos y rutas
|-- e2e/                     Tests end-to-end con Playwright
|-- docs/                    Documentacion y ADRs
|-- .github/workflows/       Pipelines de CI
|-- Makefile                 Comandos de desarrollo
|-- go.mod                   Modulo Go
`-- .env.example             Plantilla de configuracion
```

## Requisitos

- [Go](https://go.dev/dl/) 1.25 o superior.
- [Node.js](https://nodejs.org/) 22 o superior.
- PostgreSQL o un proyecto Supabase configurado.
- Cuenta y claves de Stripe para probar pagos.
- Docker si se quieren ejecutar los tests de integracion con base de datos local.

## Configuracion

Copia la plantilla de variables de entorno:

```bash
cp .env.example .env
```

Variables principales:

| Variable | Uso |
|----------|-----|
| `PORT` | Puerto del backend. |
| `GIN_MODE` | Modo de Gin, por ejemplo `debug` o `release`. |
| `CORS_ALLOW_ORIGIN` | Origen permitido para el frontend. |
| `DATABASE_URL` | URL de conexion a PostgreSQL. |
| `SUPABASE_URL` | URL del proyecto Supabase. |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave de servicio de Supabase. |
| `JWT_SECRET` | Secreto base64 para firmar tokens JWT. |
| `MESSAGE_ENCRYPTION_KEY` | Clave base64 para cifrado de mensajes. |
| `STRIPE_SECRET_KEY` | Clave privada de Stripe. |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Clave publica de Stripe para el frontend. |
| `VITE_API_BASE_URL` | URL del backend usada por Vite y la app. |

En desarrollo local, el backend suele ejecutarse en `http://localhost:8080` y el frontend en `http://localhost:5173`.

## Instalacion

Instalar dependencias y herramientas de desarrollo:

```bash
make install-dev
```

Para una instalacion de produccion:

```bash
make install-prod
```

## Ejecucion Local

Levanta el backend:

```bash
make run-backend
```

Levanta el frontend en otro terminal:

```bash
make run-frontend
```

Abre `http://localhost:5173`. El servidor de Vite reenvia `/api`, `/health` y `/ready` al backend configurado en `VITE_API_BASE_URL`.

Tambien se pueden lanzar ambos procesos con:

```bash
make -j2 run
```

## Comandos Disponibles

### Desarrollo

| Comando | Descripcion |
|---------|-------------|
| `make install-dev` | Instala dependencias y herramientas de desarrollo. |
| `make install-prod` | Instala dependencias de produccion. |
| `make run-backend` | Ejecuta el backend con recarga mediante Air. |
| `make run-frontend` | Ejecuta el servidor de desarrollo de Vite. |
| `make -j2 run` | Ejecuta backend y frontend en paralelo. |
| `make sqlc` | Regenera codigo Go a partir de las consultas SQL. |

### Build

| Comando | Descripcion |
|---------|-------------|
| `make build-backend` | Compila el binario del backend. |
| `make build-frontend` | Genera el build de produccion del frontend. |
| `make build` | Compila backend y frontend. |
| `make run-backend-prod` | Ejecuta el backend compilado. |
| `make run-frontend-prod` | Ejecuta la preview de produccion del frontend. |

### Tests

| Comando | Descripcion |
|---------|-------------|
| `make test` | Ejecuta tests de backend y frontend. |
| `make test-backend` | Ejecuta los tests del backend. |
| `make test-backend-race` | Ejecuta tests Go con detector de carreras. |
| `make test-frontend` | Ejecuta tests del frontend con Vitest. |
| `make test-frontend-coverage` | Ejecuta cobertura del frontend. |
| `make test-backend-coverage` | Ejecuta cobertura del backend. |
| `make test-coverage` | Ejecuta cobertura frontend y backend. |
| `make test-integration-docker` | Ejecuta tests de integracion con PostgreSQL en Docker. |
| `make e2e` | Ejecuta Playwright. Requiere backend y frontend levantados. |

### Calidad

| Comando | Descripcion |
|---------|-------------|
| `make fmt` | Formatea backend y frontend. |
| `make format-check` | Comprueba formato. |
| `make lint` | Ejecuta linters. |
| `make doctor` | Ejecuta diagnosticos de React. |
| `make check` | Ejecuta tests, formato, lint y doctor. |
| `make clean` | Elimina artefactos de build y reportes temporales. |

## Documentacion

- [Guia de arranque](docs/getting-started.md)
- [Buenas practicas Go](docs/golang.md)
- [Decisiones tecnicas](docs/adr/)
- [Estructura monorepo](docs/monorepo.md)

## Autores

- Jose Angel Mestas Diaz
- Elena Ondicol Garcia
- Diego Perez Gonzalez
- Lucia Gonzalez Rodriguez
