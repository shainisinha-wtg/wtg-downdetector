# Task 6: SMTP Notification Worker And Health Endpoints

## Implementation

- Renders plain-text and escaped HTML opening emails with service, report count/window, issue breakdown, first report time, and owner-console link.
- Configures a reusable Nodemailer transport that requires TLS 1.2 or newer.
- Claims bounded batches with PostgreSQL `FOR UPDATE SKIP LOCKED`.
- Uses the existing `PENDING` state plus `lockedUntil` as a 10-minute processing lease; expired leases are reclaimable without adding a redundant `PROCESSING` enum value.
- Marks successful deliveries `SENT`; transient failures use bounded exponential delay with jitter; attempt 8 becomes `FAILED`.
- Runs a signal-aware worker loop that stops claiming and waits for active delivery promises.
- Logs only job ID, incident ID, recipient domain, attempt, and outcome.
- Adds dependency-free liveness and timeout-bounded PostgreSQL readiness routes.
- Keeps post-send database failures distinct from SMTP failures so an already-sent message is not immediately rescheduled.
- Bounds SMTP connection, greeting, and socket operations below the 10-minute job lease.

## Verification

```bash
npm test -- src/modules/notifications/email-template.test.ts src/modules/notifications/job-repository.test.ts src/modules/notifications/smtp-gateway.test.ts src/app/api/health/ready/route.test.ts --run
npm run test:integration -- src/modules/notifications/job-repository.integration.test.ts --run --pool=forks --poolOptions.forks.singleFork
npm run typecheck
npm run lint
npm run build
git diff --check
```

- Unit and route tests: 6 passed
- PostgreSQL integration tests: 4 passed
- Typecheck, lint, production build, static analysis, and whitespace checks passed
- Missing worker environment exits nonzero with a sanitized fixed error
