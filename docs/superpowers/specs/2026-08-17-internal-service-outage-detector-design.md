# Internal Service Outage Detector Design

## Summary

Build an internal web application where employees anonymously report problems with company services such as Jira, Bitbucket, and VPN. The application aggregates reports into three service states, opens an incident when a configurable threshold is crossed, and emails the service-owning department once per incident.

The MVP prioritizes a low-friction employee flow, clear ownership, privacy, and reliable alert deduplication. It does not attempt statistical anomaly detection, automatic infrastructure monitoring, chat notifications, or integration with external incident-management tools.

## Goals

- Let an employee report a service problem in under 30 seconds without signing in.
- Show employees current service health, recent report volume, issue breakdowns, and owner updates.
- Let service owners configure report thresholds and manage incidents.
- Send one timely email to the owning department when a service crosses its threshold.
- Prevent accidental duplicate reports and duplicate incident notifications.
- Deploy as a production-oriented workload on company Kubernetes.

## Users And Access

### Employees

Employees access the application on the internal network without authentication. They can view service status and submit reports. Reports do not contain employee identity.

### Service Owners

Service owners sign in to a protected management area with shared local admin accounts. Passwords are hashed, sessions use secure HTTP-only cookies, and all management changes record the acting account and timestamp.

Shared accounts are acceptable for the MVP but are an explicit future migration point to company SSO.

## Employee Experience

### Service Dashboard

The first screen is the usable service dashboard, not a marketing page. It provides:

- Search by service name.
- Category filters such as Developer Tools, Connectivity, and Business Systems.
- Compact service rows showing name, current state, latest owner update, and a stable 24-hour report sparkline.
- A prominent `Report a problem` action.

Services have three report-derived states:

- `Operational`: valid reports in the active window are below 50% of the configured threshold and no incident is open.
- `Reports rising`: no incident is open and valid reports are at least 50% of the configured threshold, including the cooling period after an owner resolves an incident while reports remain elevated.
- `Incident confirmed`: an incident is open for the service.

### Report Flow

The report dialog asks for:

- A service, preselected when reporting from a service page.
- One configured issue type, initially `Unavailable`, `Slow`, `Login`, or `Connectivity`.
- An optional short note.

After a successful submission, the employee sees a receipt and cannot report the same service again during that service's configured reporting window from the same browser. If submission fails, the entered values remain available for retry.

### Service Detail

Each service page shows:

- Current state and latest owner update.
- A 24-hour report trend.
- Issue-type breakdown for the active period.
- Active incident history and updates.
- Recent resolved incidents.
- The report action.

## Owner Experience

The owner console provides compact tables for services, open incidents, recent incidents, and notification failures.

Owners can:

- Create, edit, enable, and disable services.
- Set service category, available issue types, owner department email, threshold count, and rolling time window.
- Acknowledge an open incident.
- Publish employee-visible incident updates.
- Resolve an incident with a final update.
- Inspect notification delivery state and retry a permanently failed notification.

An acknowledgement records ownership but does not change the employee-visible state. Resolving an incident closes it and allows a later threshold crossing to create a new incident.

## Detection And Incident Lifecycle

For a service configured with a threshold of 10 valid reports in 10 minutes:

1. The system counts distinct valid reporter tokens within the rolling 10-minute window.
2. At 5 reports, the service becomes `Reports rising`.
3. At 10 reports, the system atomically creates one open incident and one opening notification job.
4. Additional reports remain attached to the active time series but do not create another incident or opening email.
5. An owner acknowledges, updates, and eventually resolves the incident.
6. If an owner resolves while the rolling count remains at or above the threshold, the service stays `Reports rising` and detection remains disarmed.
7. Detection re-arms only after the rolling count falls below the threshold. A later transition from below to at or above the threshold creates a new incident.

Incident creation and opening-notification creation occur in one database transaction. Database uniqueness constraints and row locking make concurrent threshold evaluations idempotent.

## Email Notifications

Opening emails are sent through the company SMTP relay to the configured service-owner group. The message contains:

- Service name.
- Current report count and configured window.
- Issue-type breakdown.
- First report timestamp in the active window.
- A direct link to the protected owner console.

Transient delivery failures retry with exponential backoff. Exhausted retries remain visible in the owner console and can be retried manually. No second opening email is sent while the incident remains open.

## Privacy And Abuse Controls

The application creates a random opaque reporter token in the employee's browser. The server stores only an HMAC of that token on a report. It does not fingerprint devices or store an employee identity.

Controls include:

- A reporter cooldown record keyed by service and reporter-token HMAC. Report intake locks this record and rejects another report until `last_reported_at + service window`, which enforces a strict rolling cooldown even at clock-window boundaries.
- Short-lived IP-based endpoint rate limits. Raw IP addresses are not retained in report records.
- Server-side validation of service state, issue type, note length, and request size.
- Generic employee-facing errors that do not expose internal details.

This design reduces casual duplicates and abuse but cannot prove that anonymous reports come from distinct people across browsers or devices. Access through the internal network is therefore part of the security boundary.

## Architecture

### Deployable Units

The system uses a Next.js App Router modular monolith written in TypeScript. One container image supports two Kubernetes workloads:

- `web`: employee UI, owner UI, and HTTP route handlers.
- `worker`: threshold evaluation and notification delivery.

PostgreSQL is the source of truth. Prisma provides schema migrations and database access. The MVP does not require Redis; PostgreSQL locking, uniqueness constraints, and a database-backed job table provide coordination and idempotency.

### Modules

- `ServiceCatalog`: service metadata, categories, issue types, owner email, thresholds, and enabled state.
- `ReportIntake`: report validation, reporter-token handling, duplicate prevention, and persistence.
- `IncidentDetection`: rolling counts, state calculation, threshold crossing, and atomic incident creation.
- `IncidentManagement`: acknowledgement, employee-visible updates, resolution, and audit events.
- `NotificationGateway`: email rendering, SMTP delivery, retries, and delivery state.
- `AdminAuth`: password verification, session lifecycle, authorization, and login auditing.

UI and HTTP layers depend on these modules rather than directly implementing business rules. SMTP and persistence are accessed through module-owned interfaces so domain behavior can be tested independently.

## Data Model

The main records are:

- `Service`: name, slug, category, owner email, threshold count, threshold window, enabled issue types, and enabled state.
- `Report`: service, reporter-token HMAC, issue type, optional note, and creation timestamp.
- `ReporterCooldown`: service, reporter-token HMAC, and last accepted report timestamp, uniquely keyed by service and reporter token.
- `Incident`: service, state, threshold snapshot, report count at opening, opened, acknowledged, and resolved timestamps.
- `IncidentUpdate`: incident, employee-visible message, update type, actor, and timestamp.
- `NotificationJob`: incident, notification type, recipient, state, attempt count, next-attempt time, and delivery/error metadata.
- `AdminAccount`: username, password hash, enabled state, and timestamps.
- `AdminSession`: account, hashed session token, expiry, and revocation timestamp.
- `AuditEvent`: actor, action, entity type and identifier, structured metadata, and timestamp.

Threshold count and window are copied to an incident when it opens so later configuration changes do not alter the incident's recorded trigger.

## Reliability And Error Handling

- Report submission is idempotent for a reporter, service, and reporting window.
- Worker processes claim jobs with row locking that skips already claimed rows.
- Incident and opening-notification uniqueness constraints are the final defense against concurrent workers.
- Database transactions keep report aggregation, incident opening, and notification enqueueing consistent.
- The web workload exposes separate liveness and readiness endpoints. Readiness checks the database; SMTP health is reported to owners but does not make report intake unavailable.
- The worker retries transient database and SMTP failures with bounded exponential backoff.
- Structured logs include request or job correlation identifiers but exclude report notes, passwords, tokens, and raw IP addresses.

## Visual Direction

The interface is a quiet internal operations tool. It uses warm white surfaces, charcoal text, restrained teal actions, and green, amber, and red status signals. Typography is compact and optimized for scanning. Cards are reserved for repeated service items on small screens; desktop uses denser rows and tables. The UI has no marketing hero, decorative illustration, or nested cards.

Mobile prioritizes quick reporting and readable status. Desktop prioritizes searching, filtering, and comparing many services without layout shifts.

## Deployment

Kubernetes resources include:

- Web and worker Deployments using the same image and separate commands.
- An internal ClusterIP Service and company-approved ingress.
- A migration Job run during deployment.
- ConfigMaps for non-secret settings.
- Secrets for database connection, SMTP credentials, session signing, reporter-token HMAC, and bootstrap admin credentials.
- Liveness/readiness probes, resource requests and limits, pod disruption handling, and rolling updates.

The application assumes a managed PostgreSQL database and company SMTP relay are available. TLS termination and restriction to the internal company network are deployment requirements.

## Testing Strategy

- Unit tests cover state boundaries, rolling-window calculations, fresh threshold crossings, and incident lifecycle rules.
- PostgreSQL integration tests cover duplicate reports, concurrent incident creation, job claiming, and transaction rollback.
- Route tests cover validation, authorization, rate limiting, and safe error responses.
- Email tests verify rendered content and recipient selection without contacting SMTP.
- Playwright tests cover dashboard search, report submission, duplicate feedback, owner login, acknowledgement, update, and resolution.
- Deployment validation checks migrations and Kubernetes health endpoints against a test environment.

## MVP Acceptance Criteria

- An anonymous employee can find a configured service and submit one valid report from a browser.
- A duplicate report for that service within its configured window does not increase the report count.
- Dashboard and detail views reflect report-derived state and 24-hour volume.
- Crossing a service's configured threshold creates exactly one incident under concurrent submissions.
- Crossing the threshold creates exactly one opening email job addressed to the configured owner department.
- Email retries are visible, and exhausted jobs can be retried by an owner.
- An authenticated owner can acknowledge, update, and resolve an incident.
- Employee views display owner updates and resolved incident history.
- Admin changes and incident actions are auditable.
- Automated tests exercise the critical employee and owner workflows.
- The web and worker workloads deploy independently on Kubernetes and expose useful health signals.

## Deferred Work

- Company SSO for service owners.
- Baseline anomaly detection based on historical traffic.
- Active monitoring and automatic reports from observability systems.
- Microsoft Teams, Slack, SMS, or incident-management integrations.
- Per-user or per-department reporting analytics.
- Geographic maps, comments, social feeds, and public access.
