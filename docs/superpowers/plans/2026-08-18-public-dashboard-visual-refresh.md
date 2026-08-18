# Public Dashboard Visual Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the public service-status dashboard as a clear, modern operations console without changing its behavior.

**Architecture:** Retain the existing server data query and client-side filtering/report dialog state. Add only presentational markup for the public masthead and dashboard summary, then use existing component class boundaries to make service state, report pressure, filters, and actions more scannable.

**Tech Stack:** Next.js 15, React 19, TypeScript, Vitest, Testing Library, Lucide React, CSS.

## Global Constraints

- Preserve public routes, service data loading, report API behavior, and existing `data-testid` values.
- Preserve accessible names for search, category filters, and report actions.
- Use the existing Lucide icon library for any added interface iconography.
- Keep the admin console and service-detail page out of scope.
- Verify desktop and mobile presentation with Playwright screenshots after the implementation.

---

### Task 1: Protect the Public Dashboard Structure

**Files:**
- Modify: `src/app/page.test.tsx`
- Modify: `src/components/service-dashboard.test.tsx`

**Interfaces:**
- Consumes: `HomePage(): Promise<JSX.Element>` and `ServiceDashboard({ services }: ServiceDashboardProps)`.
- Produces: regression coverage for the masthead availability signal and the service-summary count while preserving filtering and reporting tests.

- [ ] **Step 1: Write the failing page-structure test**

```tsx
it("presents the dashboard as an internal service monitor", async () => {
  render(await HomePage());

  expect(screen.getByText("WTG Downdetector")).toBeVisible();
  expect(screen.getByText("Internal service monitor")).toBeVisible();
  expect(screen.getByText("Live status")).toBeVisible();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --run src/app/page.test.tsx`

Expected: FAIL because `Internal service monitor` and `Live status` are not rendered.

- [ ] **Step 3: Write the failing dashboard-summary test**

```tsx
it("announces the number of monitored services", () => {
  render(<ServiceDashboard services={mockServices} />);

  expect(screen.getByText("3 services monitored")).toBeVisible();
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npm test -- --run src/components/service-dashboard.test.tsx`

Expected: FAIL because the dashboard summary is not rendered.

### Task 2: Build the Operations Dashboard Presentation

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/service-dashboard.tsx`
- Modify: `src/components/service-row.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: `ServiceListItem[]`, `ServiceRowProps`, the existing CSS class names, and all current test IDs.
- Produces: `Internal service monitor`, `Live status`, and `{count} services monitored` visual hierarchy while keeping filtering and reporting callbacks unchanged.

- [ ] **Step 1: Add the masthead and summary markup**

In `src/app/page.tsx`, replace the plain header with semantic product and status groups:

```tsx
<header className="site-header">
  <div className="site-header__brand">
    <strong>WTG Downdetector</strong>
    <span>Internal service monitor</span>
  </div>
  <div className="site-header__status">
    <span className="site-header__status-dot" aria-hidden="true" />
    Live status
  </div>
</header>
```

In `ServiceDashboard`, add the service count beneath `Service status`:

```tsx
<div>
  <p className="dashboard-kicker">Operational overview</p>
  <h1>Service status</h1>
  <p className="dashboard-summary">
    {services.length} {services.length === 1 ? "service" : "services"} monitored
  </p>
</div>
```

- [ ] **Step 2: Make service rows scannable without changing behavior**

In `ServiceRow`, keep the current `data-testid`, status badge, sparkline aria label, and report action. Group the service title and report statistic into an identity block, preserve the owner update as a full-width status note, and place the sparkline/action in a fixed-width activity area.

```tsx
<div className="service-info">
  <div>
    <p className="service-category">{category}</p>
    <h3 className="service-name">{name}</h3>
  </div>
  <StatusBadge state={currentState} />
  <div className="service-stats">
    <strong>{reportCount}</strong> / {threshold} reports
  </div>
</div>
```

- [ ] **Step 3: Implement the visual system in the shared stylesheet**

Update `globals.css` with the following behavior:

```css
@import url("https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Manrope:wght@400;500;600;700;800&display=swap");

:root {
  --color-paper: #f4f6f1;
  --color-ink: #17201f;
  --color-teal: #006e67;
  --color-line: #d7ddd6;
  --color-muted: #66736e;
}

body {
  background: var(--color-paper);
  color: var(--color-ink);
  font-family: "Manrope", sans-serif;
}

.site-header,
.dashboard-container {
  max-width: 1200px;
  margin: 0 auto;
}

.site-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 76px;
  padding: 0 24px;
}

.service-row {
  border-radius: 8px;
  border-color: var(--color-line);
  box-shadow: 0 1px 0 rgb(23 32 31 / 4%);
}

@media (max-width: 700px) {
  .site-header,
  .dashboard-header,
  .service-row {
    align-items: stretch;
  }

  .site-header,
  .dashboard-header {
    flex-direction: column;
  }

  .service-row {
    grid-template-columns: 1fr;
  }
}
```

Complete the related class rules for the masthead, toolbar, segmented filters, service identity, activity area, dialog, focus styles, and stable mobile layout. Keep corner radii at 8px or less and retain all existing state colors.

- [ ] **Step 4: Run the focused unit tests to verify the implementation passes**

Run: `npm test -- --run src/app/page.test.tsx src/components/service-dashboard.test.tsx`

Expected: PASS with existing filter/report behaviors and the two new hierarchy assertions.

- [ ] **Step 5: Run static validation**

Run: `npm run typecheck && npm run build`

Expected: both commands exit with code 0.

### Task 3: Verify Responsive Presentation

**Files:**
- No source changes expected.

**Interfaces:**
- Consumes: the local Next.js server and existing public route `/`.
- Produces: desktop and mobile visual evidence that the public UI is legible and does not overflow.

- [ ] **Step 1: Start the public app with required local environment variables**

Run:

```bash
PORT=3200 E2E_TEST_MODE=1 E2E_RESET_SECRET='local-e2e-reset-secret-at-least-32-bytes' DATABASE_URL='postgresql://wtg:wtg_local_test@127.0.0.1:55432/wtg_downdetector' DIRECT_URL='postgresql://wtg:wtg_local_test@127.0.0.1:55432/wtg_downdetector' REPORTER_HMAC_SECRET='local-reporter-hmac-secret-at-least-32-bytes' SESSION_SECRET='local-session-secret-at-least-32-bytes' npm run dev
```

Expected: Next.js listens on `http://localhost:3200`.

- [ ] **Step 2: Capture desktop and mobile screenshots of `/`**

Use Playwright at `1440x1000` and `390x844`, then inspect the screenshots. Confirm the masthead, report action, filter toolbar, service-row content, and owner update remain legible with no horizontal scroll or overlapping text.

- [ ] **Step 3: Run the public browser test suite**

Run: `npm run test:e2e -- tests/e2e/employee-report.spec.ts`

Expected: PASS, confirming search and report submission remain usable from the refreshed interface.
