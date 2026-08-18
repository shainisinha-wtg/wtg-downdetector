# WTG Downdetector

WTG Downdetector is an internal service-status application. Employees can anonymously report problems with services such as Jira, Bitbucket, and VPN. Configurable report thresholds open incidents for service owners, who can acknowledge, update, and resolve incidents from the owner console.

This repository currently packages a Docker-only proof of concept. Kubernetes deployment is deferred.

## Prerequisites

- Docker Engine with Docker Compose v2
- Node.js 24 and npm 11 for source development and tests
- OpenSSL for generating local secrets
- An SMTP relay only when testing owner notifications

## Docker POC

Generate local credentials in the current shell. Do not commit these values:

```bash
export POSTGRES_PASSWORD="$(openssl rand -hex 24)"
export REPORTER_HMAC_SECRET="$(openssl rand -hex 32)"
export SESSION_SECRET="$(openssl rand -hex 32)"
# Keep false for the local HTTP Compose app; set true behind HTTPS.
# export COOKIE_SECURE=true
# Optional when port 3000 is already in use:
# export WEB_PORT=3001
```

Build the image, start PostgreSQL, apply migrations, seed the default catalog and
`admin` / `admin` owner account, and start the web application:

```bash
docker compose up --build -d web
```

WTG Downdetector is then available at <http://localhost:3000>. The owner login is at <http://localhost:3000/admin/login> with username `admin` and password `admin`.

Useful lifecycle commands:

```bash
docker compose ps
docker compose logs -f web
docker compose down
```

`docker compose down -v` also deletes the local PostgreSQL data volume and is destructive.

## Database Operations

Apply pending Prisma migrations explicitly with:

```bash
docker compose run --rm migrate
```

The Compose stack runs the idempotent seed automatically after migrations and
before the web service starts. To re-run it manually:

```bash
docker compose run --rm seed
```

The Compose stack uses PostgreSQL 16 and persists data in the `postgres-data` volume. `DATABASE_URL` and `DIRECT_URL` are assembled inside Compose from `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB`.

The local Compose stack defaults `COOKIE_SECURE` to `false` because it serves HTTP on localhost. Set `COOKIE_SECURE=true` when deploying behind HTTPS.

## Notification Worker

The worker is optional and is enabled through the `notifications` Compose profile. Configure the SMTP relay in the current shell:

```bash
export APP_BASE_URL="http://localhost:3000"
export SMTP_HOST="smtp.internal.example"
export SMTP_PORT="587"
export SMTP_USERNAME="replace-me"
export SMTP_PASSWORD="replace-me"
export SMTP_FROM="service-status@example.internal"
docker compose --profile notifications up -d worker
```

`SMTP_USERNAME` and `SMTP_PASSWORD` must either both be set or both be omitted. The worker leases pending notification jobs, retries transient failures with bounded exponential backoff, and marks a job failed after eight attempts.

Failed notifications appear in the owner console. An owner can use **Retry** to return a failed job to the pending queue and reset its attempt state.

## Health Checks

- `GET /api/health/live` confirms the web process is alive.
- `GET /api/health/ready` confirms PostgreSQL is reachable.

Examples:

```bash
curl --fail http://localhost:3000/api/health/live
curl --fail http://localhost:3000/api/health/ready
```

The image health check uses the liveness endpoint.

## Source Development

Install dependencies and generate the Prisma client:

```bash
npm ci
npx prisma generate
```

Start only the Compose PostgreSQL service, then expose its connection to local commands:

```bash
export POSTGRES_PASSWORD="$(openssl rand -hex 24)"
export POSTGRES_PORT=5432
docker compose up -d postgres
export DATABASE_URL="postgresql://wtg:${POSTGRES_PASSWORD}@127.0.0.1:${POSTGRES_PORT}/wtg_downdetector"
export DIRECT_URL="$DATABASE_URL"
npx prisma migrate deploy
npx prisma db seed
```

Set `REPORTER_HMAC_SECRET` and `SESSION_SECRET` to random values of at least 32 bytes, then run:

```bash
npm run dev
```

Run the worker directly from source with `npm run worker` after setting `APP_BASE_URL` and the SMTP variables.

## Tests

Unit, integration, static, and production build checks:

```bash
npm test -- --run
npm run test:integration -- --run
npm run typecheck
npm run lint
npm run build
```

Integration tests require a migrated, dedicated PostgreSQL test database through `TEST_DATABASE_URL`. The test runner maps that URL to `DATABASE_URL` and `DIRECT_URL`; it refuses to start when `TEST_DATABASE_URL` is missing so test cleanup cannot modify the application database. They run with one worker because their cleanup shares database tables.

For example:

```bash
export TEST_DATABASE_URL="postgresql://wtg:wtg_local_test@127.0.0.1:55432/wtg_downdetector"
export DATABASE_URL="$TEST_DATABASE_URL"
export DIRECT_URL="$TEST_DATABASE_URL"
npx prisma migrate deploy
npm run test:integration -- --run
```

Playwright covers the employee reporting and owner incident journeys in desktop Chromium and a Pixel 7 viewport. On Linux hosts without Playwright browser libraries, run it in the official image:

```bash
docker run --rm --network host \
  --user "$(id -u):$(id -g)" \
  -e HOME=/tmp \
  -e DATABASE_URL -e DIRECT_URL \
  -e REPORTER_HMAC_SECRET -e SESSION_SECRET \
  -v "$PWD:/work" -w /work \
  mcr.microsoft.com/playwright:v1.62.1-noble \
  npx playwright test
```

Playwright starts `npm run dev` in test mode inside this browser container; it does not target the production Compose web service. The E2E reset endpoint requires test mode and a per-run secret, and production builds always return `404` for it.

## Image Build

Build the same image used by the web, migration, seed, bootstrap, and worker commands:

```bash
docker build -t wtg-downdetector:local .
```

The runtime image runs as the non-root `nextjs` user and contains no environment files. Runtime roles are:

```bash
node server.js
node dist/worker.cjs
node node_modules/prisma/build/index.js migrate deploy
node dist/seed.cjs
```

## Credential Rotation

Generate replacement application secrets, update the deployment environment, and recreate the web and worker containers. Rotating `REPORTER_HMAC_SECRET` starts new anonymous reporter identities; rotating `SESSION_SECRET` invalidates existing owner sessions.

For the local Compose database, change the PostgreSQL role password first, update `POSTGRES_PASSWORD`, and recreate dependent containers. For disposable POC data, the simpler destructive option is `docker compose down -v` followed by a fresh startup with a new password.

Rotate SMTP credentials at the relay, update the shell or secret store, and recreate the worker. For the local POC, rerun `node dist/seed.cjs` to restore the documented `admin` / `admin` owner account.

## Deployment Scope

Kubernetes manifests, ingress, cluster secrets, resource limits, and rollout configuration are intentionally deferred. The current deliverable is a Docker and Docker Compose proof of concept for WTG Downdetector.
