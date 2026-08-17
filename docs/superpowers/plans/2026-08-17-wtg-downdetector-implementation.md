# WTG Downdetector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `wtg-downdetector`, an internal service-status application that accepts anonymous reports, detects configurable outage thresholds, emails service owners once per incident, and provides a protected owner console.

**Architecture:** A Next.js App Router modular monolith exposes employee and owner interfaces plus HTTP route handlers. PostgreSQL and Prisma hold all application, incident, cooldown, session, audit, and notification-job state; a worker command from the same image evaluates queued email jobs. Kubernetes deploys web and worker workloads independently.

**Tech Stack:** Node.js 24, TypeScript, Next.js App Router, React, Prisma, PostgreSQL, Zod, Argon2, Nodemailer, Vitest, Testing Library, Playwright, Docker, Kubernetes.

## Global Constraints

- Use `wtg-downdetector` for package metadata, page metadata, container image, and Kubernetes resource names.
- Keep the supplied PostgreSQL URL only in local environment or Kubernetes Secret state; never write it to source, tests, documentation, shell scripts, or Git history.
- Employees report anonymously without authentication; store only an HMAC of the random browser reporter token.
- Owners authenticate with hashed shared local accounts and secure HTTP-only sessions.
- Service thresholds are independently configurable by count and rolling time window.
- Incident creation and opening-notification creation must be atomic and idempotent.
- Do not add Redis, SSO, external monitoring, chat integrations, or anomaly detection to the MVP.
- The deployment target is company Kubernetes with managed PostgreSQL and company SMTP.

---

### Task 1: Project Foundation And Test Harness

**Files:**
- Create: `package.json`
- Create: `next.config.ts`
- Create: `tsconfig.json`
- Create: `eslint.config.mjs`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `src/app/layout.tsx`
- Create: `src/app/globals.css`
- Create: `src/app/page.tsx`
- Create: `src/test/setup.ts`
- Test: `src/app/page.test.tsx`

**Interfaces:**
- Consumes: Node.js 24 and npm 11 available in the workspace.
- Produces: Next.js application scripts `dev`, `build`, `lint`, `typecheck`, `test`, `test:integration`, `test:e2e`, and `worker`; path alias `@/* -> ./src/*`.

- [ ] **Step 1: Initialize source control and scaffold Next.js**

Run:

```bash
git init
npx create-next-app@latest . --ts --eslint --app --src-dir --use-npm --import-alias '@/*' --empty
npm install @prisma/client zod argon2 nodemailer lucide-react
npm install -D prisma vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @playwright/test tsx @types/nodemailer
```

Expected: the package installs successfully and `package.json` exists. Set its `name` field to `wtg-downdetector`.

- [ ] **Step 2: Add the failing application-shell test**

Create `src/app/page.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "./page";

describe("HomePage", () => {
  it("identifies the internal status dashboard", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { name: "Service status" })).toBeVisible();
    expect(screen.getByText("WTG Downdetector")).toBeVisible();
  });
});
```

- [ ] **Step 3: Configure Vitest and verify the test fails**

Create `vitest.config.ts` with React, `jsdom`, `@/` alias resolution, and setup file `src/test/setup.ts`; import `@testing-library/jest-dom/vitest` from the setup file.

Run: `npm test -- src/app/page.test.tsx`

Expected: FAIL because the generated page does not contain the required heading and product name.

- [ ] **Step 4: Implement the minimal application shell and global tokens**

Set metadata title to `WTG Downdetector`, render a compact top bar and `Service status` heading, and define CSS variables for warm white, charcoal, teal, green, amber, and red. Keep the first screen application-focused with no marketing hero.

```tsx
export default function HomePage() {
  return (
    <main>
      <header><strong>WTG Downdetector</strong></header>
      <section aria-labelledby="service-status-heading">
        <h1 id="service-status-heading">Service status</h1>
      </section>
    </main>
  );
}
```

- [ ] **Step 5: Add safe environment examples**

Create `.env.example` using placeholders only:

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require
REPORTER_HMAC_SECRET=replace-with-at-least-32-random-bytes
SESSION_SECRET=replace-with-at-least-32-random-bytes
SMTP_HOST=smtp.internal.example
SMTP_PORT=587
SMTP_USER=replace-me
SMTP_PASSWORD=replace-me
SMTP_FROM=service-status@example.internal
APP_URL=https://status.example.internal
```

Ensure `.env`, `.env.local`, `.env.*.local`, Playwright artifacts, and generated Prisma client output are ignored.

- [ ] **Step 6: Verify foundation**

Run: `npm test -- src/app/page.test.tsx && npm run typecheck && npm run lint`

Expected: all commands exit 0.

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "chore: scaffold wtg downdetector"
```

---

### Task 2: PostgreSQL Schema And Service Catalog

**Files:**
- Create: `prisma/schema.prisma`
- Create: `prisma/seed.ts`
- Create: `src/lib/db.ts`
- Create: `src/modules/services/types.ts`
- Create: `src/modules/services/service-repository.ts`
- Test: `src/modules/services/service-repository.integration.test.ts`

**Interfaces:**
- Consumes: `DATABASE_URL` from process environment.
- Produces: `prisma`, `ServiceRepository.listEnabled(): Promise<ServiceSummary[]>`, `ServiceRepository.findBySlug(slug: string): Promise<ServiceDetails | null>`, and persisted records specified by the design.

- [ ] **Step 1: Define an integration test for seeded services**

```ts
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { ServiceRepository } from "./service-repository";

describe("ServiceRepository", () => {
  beforeAll(async () => {
    await prisma.service.createMany({
      data: [
        { name: "Jira", slug: "jira", category: "Developer Tools", ownerEmail: "jira-owners@example.internal", thresholdCount: 10, thresholdWindowMinutes: 10, issueTypes: ["UNAVAILABLE", "SLOW", "LOGIN"], enabled: true },
        { name: "Legacy", slug: "legacy", category: "Business Systems", ownerEmail: "legacy@example.internal", thresholdCount: 5, thresholdWindowMinutes: 10, issueTypes: ["UNAVAILABLE"], enabled: false },
      ],
      skipDuplicates: true,
    });
  });

  it("returns enabled services only", async () => {
    const services = await new ServiceRepository(prisma).listEnabled();
    expect(services.map(({ slug }) => slug)).toContain("jira");
    expect(services.map(({ slug }) => slug)).not.toContain("legacy");
  });
});
```

- [ ] **Step 2: Add the Prisma schema**

Define enums `IssueType`, `IncidentState`, `NotificationState`, and `IncidentUpdateType`. Define `Service`, `Report`, `ReporterCooldown`, `Incident`, `IncidentUpdate`, `NotificationJob`, `AdminAccount`, `AdminSession`, and `AuditEvent` with UUID identifiers, timestamps, indexes on report service/time and notification state/next attempt, and these uniqueness rules:

```prisma
model ReporterCooldown {
  id                String   @id @default(uuid()) @db.Uuid
  serviceId         String   @db.Uuid
  reporterTokenHmac String
  lastReportedAt    DateTime
  service           Service  @relation(fields: [serviceId], references: [id], onDelete: Cascade)

  @@unique([serviceId, reporterTokenHmac])
}

model Incident {
  id                      String        @id @default(uuid()) @db.Uuid
  serviceId               String        @db.Uuid
  state                   IncidentState @default(OPEN)
  thresholdCountSnapshot  Int
  thresholdWindowSnapshot Int
  reportCountAtOpening    Int
  openedAt                DateTime      @default(now())
  acknowledgedAt          DateTime?
  resolvedAt              DateTime?
  service                 Service       @relation(fields: [serviceId], references: [id])

  @@index([serviceId, state])
}
```

Use a partial unique index migration for one open incident per service:

```sql
CREATE UNIQUE INDEX "Incident_one_open_per_service"
ON "Incident" ("serviceId") WHERE "state" = 'OPEN';
```

- [ ] **Step 3: Generate and migrate to the supplied database**

Put the supplied URL into the ignored `.env` file as `DATABASE_URL` without printing it. Since `psql` is not installed locally, use Prisma for connectivity and migrations. Confirm `.env` is ignored with `git check-ignore .env` before writing the value.

Run: `npx prisma validate && npx prisma generate && npx prisma migrate dev --name init`

Expected: schema validation succeeds, client generation succeeds, and the migration applies over required SSL.

- [ ] **Step 4: Implement the repository and seed**

Return only enabled services from public methods. Seed Jira, Bitbucket, and VPN with categories, owner placeholders, issue types, and conservative threshold defaults. Make the seed idempotent with `upsert` by slug.

- [ ] **Step 5: Verify the repository**

Run: `npm run test:integration -- src/modules/services/service-repository.integration.test.ts`

Expected: PASS with enabled services filtered correctly.

- [ ] **Step 6: Commit**

```bash
git add prisma src/lib src/modules/services package.json package-lock.json
git commit -m "feat: add service catalog persistence"
```

---

### Task 3: Anonymous Report Intake And Incident Detection

**Files:**
- Create: `src/modules/reports/report-schema.ts`
- Create: `src/modules/reports/reporter-token.ts`
- Create: `src/modules/reports/report-intake.ts`
- Create: `src/modules/incidents/service-state.ts`
- Create: `src/modules/incidents/incident-detector.ts`
- Test: `src/modules/incidents/service-state.test.ts`
- Test: `src/modules/reports/report-intake.integration.test.ts`
- Test: `src/modules/incidents/incident-detector.integration.test.ts`

**Interfaces:**
- Consumes: Prisma transaction client, `REPORTER_HMAC_SECRET`, service threshold configuration.
- Produces: `submitReport(input: ReportInput, reporterToken: string): Promise<ReportReceipt>`, `getServiceState(serviceId: string): Promise<ServiceState>`, and `evaluateService(serviceId: string): Promise<DetectionResult>`.

- [ ] **Step 1: Write state-boundary tests**

```ts
import { describe, expect, it } from "vitest";
import { deriveServiceState } from "./service-state";

describe("deriveServiceState", () => {
  it.each([
    [4, 10, false, true, "OPERATIONAL"],
    [5, 10, false, true, "REPORTS_RISING"],
    [10, 10, true, false, "INCIDENT_CONFIRMED"],
    [10, 10, false, false, "REPORTS_RISING"],
  ] as const)("maps report state", (count, threshold, hasOpenIncident, armed, expected) => {
    expect(deriveServiceState({ count, threshold, hasOpenIncident, armed })).toBe(expected);
  });
});
```

Run: `npm test -- src/modules/incidents/service-state.test.ts`

Expected: FAIL because `deriveServiceState` does not exist.

- [ ] **Step 2: Implement state derivation and token HMAC**

```ts
export type ServiceState = "OPERATIONAL" | "REPORTS_RISING" | "INCIDENT_CONFIRMED";

export function deriveServiceState(input: { count: number; threshold: number; hasOpenIncident: boolean; armed: boolean }): ServiceState {
  if (input.hasOpenIncident) return "INCIDENT_CONFIRMED";
  if (!input.armed || input.count >= Math.ceil(input.threshold / 2)) return "REPORTS_RISING";
  return "OPERATIONAL";
}
```

Use `createHmac("sha256", secret).update(token).digest("hex")` and require a token with at least 128 bits of entropy.

- [ ] **Step 3: Write report cooldown and incident idempotency integration tests**

Cover: accepted report, unsupported issue type, note over 500 characters, second report during cooldown, report after cooldown, exactly one open incident under concurrent threshold submissions, exactly one `OPENING` notification job, and detector re-arming only after count drops below threshold.

Use `Promise.allSettled` for concurrent submissions and assert database counts, not only return values.

- [ ] **Step 4: Implement transactional report intake**

Validate with Zod, lock or upsert the `ReporterCooldown`, compare `lastReportedAt` against the service rolling window, create the report, update cooldown, and invoke detection in one transaction. Return:

```ts
export type ReportReceipt = {
  reportId: string;
  acceptedAt: Date;
  nextAllowedAt: Date;
  serviceState: ServiceState;
};
```

Represent duplicate cooldown as a typed `DuplicateReportError` containing `nextAllowedAt`; do not expose the token HMAC.

- [ ] **Step 5: Implement atomic incident detection**

Count distinct reporter HMACs inside `now - thresholdWindowMinutes`, lock the service row, check for an open incident, and create the incident plus notification job in the same transaction when armed and over threshold. Store detector arming state on `Service.detectionArmed`; set it false when opening and true only after the count falls below threshold.

- [ ] **Step 6: Verify report and detection behavior**

Run:

```bash
npm test -- src/modules/incidents/service-state.test.ts
npm run test:integration -- src/modules/reports/report-intake.integration.test.ts src/modules/incidents/incident-detector.integration.test.ts
```

Expected: all tests pass, including concurrent idempotency.

- [ ] **Step 7: Commit**

```bash
git add prisma src/modules/reports src/modules/incidents
git commit -m "feat: detect incidents from anonymous reports"
```

---

### Task 4: Employee API And Dashboard

**Files:**
- Create: `src/app/api/services/route.ts`
- Create: `src/app/api/services/[slug]/route.ts`
- Create: `src/app/api/reports/route.ts`
- Create: `src/components/service-dashboard.tsx`
- Create: `src/components/service-row.tsx`
- Create: `src/components/report-dialog.tsx`
- Create: `src/components/status-badge.tsx`
- Create: `src/app/services/[slug]/page.tsx`
- Create: `src/modules/services/service-queries.ts`
- Modify: `src/app/page.tsx`
- Test: `src/app/api/reports/route.test.ts`
- Test: `src/components/service-dashboard.test.tsx`

**Interfaces:**
- Consumes: service repository, report intake, service-state derivation.
- Produces: public JSON endpoints and accessible employee dashboard/report flow.

- [ ] **Step 1: Write failing route tests**

Test `POST /api/reports` with a valid body and `wtg-reporter` cookie, malformed JSON, unknown service, duplicate report, and absent cookie. The absent-cookie response must create a random secure cookie and use it for the accepted report.

Expected response contract:

```ts
type ReportResponse =
  | { ok: true; nextAllowedAt: string; serviceState: ServiceState }
  | { ok: false; code: "INVALID_REPORT" | "DUPLICATE_REPORT" | "RATE_LIMITED"; nextAllowedAt?: string };
```

Run: `npm test -- src/app/api/reports/route.test.ts`

Expected: FAIL because the route is absent.

- [ ] **Step 2: Implement public routes and in-process rate limiting**

Set `wtg-reporter` with `httpOnly: true`, `secure` in production, `sameSite: "lax"`, one-year expiry, and root path. Apply a bounded in-memory per-IP limiter suitable for one pod; document ingress-level distributed rate limiting as required for production. Never persist the raw IP.

- [ ] **Step 3: Write dashboard interaction tests**

Test searching `jira`, filtering `Connectivity`, opening the report dialog from the VPN row, selecting `Slow`, preserving the form after a server error, and rendering the receipt after success.

- [ ] **Step 4: Implement the dashboard and service detail page**

Use server components for initial service data and a client component only for search, filters, and the dialog. Use Lucide icons for search, alert, and close actions. Render 24 one-hour report buckets as an accessible CSS bar sparkline with a text summary; avoid a chart dependency.

- [ ] **Step 5: Verify employee experience**

Run: `npm test -- src/app/api/reports/route.test.ts src/components/service-dashboard.test.tsx && npm run typecheck && npm run lint`

Expected: all checks pass.

- [ ] **Step 6: Commit**

```bash
git add src/app src/components src/modules/services
git commit -m "feat: add employee status and reporting flow"
```

---

### Task 5: Owner Authentication And Incident Console

**Files:**
- Create: `src/modules/auth/password.ts`
- Create: `src/modules/auth/session.ts`
- Create: `src/modules/auth/require-admin.ts`
- Create: `src/app/admin/login/page.tsx`
- Create: `src/app/admin/actions.ts`
- Create: `src/app/admin/page.tsx`
- Create: `src/app/admin/services/page.tsx`
- Create: `src/app/admin/incidents/[id]/page.tsx`
- Create: `src/modules/incidents/incident-management.ts`
- Test: `src/modules/auth/session.integration.test.ts`
- Test: `src/modules/incidents/incident-management.integration.test.ts`

**Interfaces:**
- Consumes: `AdminAccount`, `AdminSession`, `Incident`, `IncidentUpdate`, and `AuditEvent` persistence.
- Produces: `createSession(accountId: string)`, `requireAdmin()`, `acknowledgeIncident`, `publishIncidentUpdate`, `resolveIncident`, and protected owner pages/actions.

- [ ] **Step 1: Write failing auth and incident lifecycle tests**

Verify Argon2id password hashing, only hashed session tokens in PostgreSQL, expiry/revocation enforcement, unauthenticated redirect to `/admin/login`, acknowledgement, public update, resolution, detector staying disarmed while counts remain elevated, and an audit event for every mutation.

- [ ] **Step 2: Implement shared-account authentication**

Hash passwords with Argon2id. Generate 32-byte session tokens, store SHA-256 hashes, and send the raw value only in a `wtg-admin-session` secure HTTP-only cookie. Session duration is 8 hours. Login responses use a generic invalid-credentials error.

- [ ] **Step 3: Implement incident lifecycle methods**

Every method accepts an authenticated actor ID and executes the incident mutation, update creation, and audit event in one transaction. Reject invalid transitions with typed errors; acknowledgement is allowed once, updates only while open, and resolution requires a non-empty final message of at most 1,000 characters.

- [ ] **Step 4: Implement protected owner pages**

Render compact tables for open/recent incidents, service threshold configuration, and failed notifications. Use server actions with Zod validation and revalidate affected employee/admin paths after mutations.

- [ ] **Step 5: Add a bootstrap-admin command**

Create `scripts/bootstrap-admin.ts` that reads `BOOTSTRAP_ADMIN_USERNAME` and `BOOTSTRAP_ADMIN_PASSWORD`, hashes the password, and upserts the account. It must never print the password or hash.

- [ ] **Step 6: Verify owner workflows**

Run: `npm run test:integration -- src/modules/auth/session.integration.test.ts src/modules/incidents/incident-management.integration.test.ts && npm run typecheck && npm run lint`

Expected: all checks pass.

- [ ] **Step 7: Commit**

```bash
git add src/app/admin src/modules/auth src/modules/incidents scripts
git commit -m "feat: add owner incident console"
```

---

### Task 6: SMTP Notification Worker And Health Endpoints

**Files:**
- Create: `src/modules/notifications/email-template.ts`
- Create: `src/modules/notifications/smtp-gateway.ts`
- Create: `src/modules/notifications/job-repository.ts`
- Create: `src/worker.ts`
- Create: `src/app/api/health/live/route.ts`
- Create: `src/app/api/health/ready/route.ts`
- Test: `src/modules/notifications/email-template.test.ts`
- Test: `src/modules/notifications/job-repository.integration.test.ts`
- Test: `src/app/api/health/ready/route.test.ts`

**Interfaces:**
- Consumes: pending `NotificationJob` rows and SMTP environment variables.
- Produces: `renderIncidentOpeningEmail`, `claimDueJobs(limit: number)`, `deliverJob(jobId: string)`, `npm run worker`, liveness, and readiness routes.

- [ ] **Step 1: Write failing email and claim tests**

Verify email subject/body include service, count/window, issue breakdown, first report timestamp, and admin link. Verify two concurrent claimers cannot claim the same job, successful delivery marks `SENT`, transient failure schedules exponential retry, and attempt 8 marks `FAILED`.

- [ ] **Step 2: Implement the email template and SMTP adapter**

Return both plain text and escaped HTML. Configure Nodemailer from environment, require TLS, and log only job ID, incident ID, recipient domain, attempt, and outcome.

- [ ] **Step 3: Implement database-backed claiming**

Claim due jobs with a short transaction and PostgreSQL `FOR UPDATE SKIP LOCKED`. Mark claimed rows `PROCESSING` with `lockedAt`; reclaim locks older than 10 minutes. Retry delays are `min(2 ** attempt * 30 seconds, 30 minutes)` with bounded jitter.

- [ ] **Step 4: Implement the worker loop and shutdown**

Poll due work, process a bounded batch, and handle `SIGTERM`/`SIGINT` by stopping claims and waiting for active deliveries. Exit nonzero for invalid environment configuration; survive individual delivery failures.

- [ ] **Step 5: Implement health endpoints**

`/api/health/live` returns 200 without external calls. `/api/health/ready` executes `SELECT 1` with a timeout and returns 503 on database failure. SMTP state is shown in the admin console and does not make web readiness fail.

- [ ] **Step 6: Verify notifications and health**

Run: `npm test -- src/modules/notifications/email-template.test.ts src/app/api/health/ready/route.test.ts && npm run test:integration -- src/modules/notifications/job-repository.integration.test.ts`

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/modules/notifications src/worker.ts src/app/api/health package.json
git commit -m "feat: deliver incident email notifications"
```

---

### Task 7: End-To-End Validation And Kubernetes Deployment

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`
- Create: `k8s/configmap.yaml`
- Create: `k8s/secret.example.yaml`
- Create: `k8s/web-deployment.yaml`
- Create: `k8s/worker-deployment.yaml`
- Create: `k8s/service.yaml`
- Create: `k8s/ingress.yaml`
- Create: `k8s/migration-job.yaml`
- Create: `tests/e2e/employee-report.spec.ts`
- Create: `tests/e2e/owner-incident.spec.ts`
- Create: `README.md`

**Interfaces:**
- Consumes: completed web application, worker command, managed PostgreSQL, SMTP relay, and Kubernetes ingress.
- Produces: production image and Kubernetes resources named `wtg-downdetector`, plus executable setup and operations documentation.

- [ ] **Step 1: Write employee and owner Playwright journeys**

Employee test: search Jira, submit `Unavailable`, see receipt, retry, and see duplicate feedback. Owner test: sign in, observe the created incident, acknowledge it, publish an update, resolve it, and verify the public service page shows the final update and resolved history.

- [ ] **Step 2: Run journeys to verify they fail**

Run: `npx playwright test tests/e2e/employee-report.spec.ts tests/e2e/owner-incident.spec.ts`

Expected: FAIL until deterministic E2E seed/reset helpers and remaining accessibility selectors are added.

- [ ] **Step 3: Add deterministic E2E setup and finish the flows**

Add a test-only reset endpoint guarded by `NODE_ENV === "test"` and a random `E2E_RESET_SECRET`. Seed one owner and low Jira threshold. Do not expose the endpoint in production builds without the secret check.

- [ ] **Step 4: Add a multi-stage production image**

Build with Node 24 slim, Next.js standalone output, a non-root runtime user, and one image supporting `node server.js` for web and `node dist/worker.js` for worker. Include Prisma migration assets but no environment files.

- [ ] **Step 5: Add Kubernetes manifests**

Use namespace-neutral resource names prefixed `wtg-downdetector`. Configure web and worker Deployments separately, ClusterIP Service, ingress placeholder host, migration Job, resource requests/limits, rolling update strategy, pod security context, and web liveness/readiness probes. `k8s/secret.example.yaml` must contain placeholders only and use `stringData` keys, never the supplied URL.

- [ ] **Step 6: Document setup and operations**

README sections: purpose, prerequisites, local environment, Prisma migration/seed, bootstrap admin, development, tests, worker, SMTP, image build, Kubernetes secret creation from the operator's shell, deployment order, health endpoints, retry operations, and credential rotation. Name the application `WTG Downdetector` throughout.

- [ ] **Step 7: Run full verification**

Run:

```bash
npm test
npm run test:integration
npm run typecheck
npm run lint
npm run build
npx playwright test
docker build -t wtg-downdetector:local .
```

Expected: every command exits 0; Playwright passes desktop and mobile projects; the image builds without secrets.

- [ ] **Step 8: Inspect manifests and secret history**

Run:

```bash
kubectl apply --dry-run=client -f k8s/
git grep -nE '(postgres|postgresql)://[^[:space:]]+:[^[:space:]]+@' -- .
```

Expected: Kubernetes resources validate and secret scan returns no matches.

- [ ] **Step 9: Commit**

```bash
git add Dockerfile .dockerignore k8s tests README.md next.config.ts
git commit -m "feat: package wtg downdetector for kubernetes"
```

## Completion Check

Run the full verification suite from Task 7 and verify every MVP acceptance criterion in the design document maps to a passing automated test. Before deployment, rotate the database credential supplied through chat and inject the replacement directly as a Kubernetes Secret or deployment-platform secret; do not commit it.
