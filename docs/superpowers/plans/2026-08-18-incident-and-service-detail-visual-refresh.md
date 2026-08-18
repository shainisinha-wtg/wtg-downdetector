# Incident and Service Detail Visual Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the owner incident-detail page and public service-detail page into the established operations-console visual system without changing workflow behavior.

**Architecture:** Retain current server-rendered page queries, `notFound` behavior, and server action handlers. Reuse `AdminShell` for the owner page and extend token-backed global CSS with scoped incident-detail and service-detail classes; the client report trigger remains untouched.

**Tech Stack:** Next.js 15, React 19, TypeScript, Vitest, Testing Library, Lucide React, CSS.

## Global Constraints

- Preserve `/admin/incidents/[id]` and `/services/[slug]` routes, queries, authorization, actions, field names, and report trigger behavior.
- Reuse existing public and owner token-backed CSS classes, with corner radii of 8px or less.
- Preserve `incident-update-note`, `incident-resolution-message`, `note`, and `finalMessage` form contracts.
- Keep all actions and reporting controls available and readable at desktop and mobile widths.

---

### Task 1: Modernize the Owner Incident Detail

**Files:**
- Modify: `src/app/admin/incidents/[id]/page.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: `AdminShell`, `requireAdmin`, existing Prisma incident query, and the three existing incident action functions.
- Produces: a shared-shell incident page with incident facts, state badge, action sections, and timeline while retaining current forms.

- [ ] **Step 1: Add a failing incident-detail structure test**

Create `src/app/admin/incidents/[id]/page.test.tsx` with mocks for `requireAdmin`, Prisma `incident.findUnique`, and Next `notFound`. Render an OPEN incident and assert:

```tsx
expect(screen.getByText("Incident overview")).toBeVisible();
expect(screen.getByText("Timeline")).toBeVisible();
expect(screen.getByRole("button", { name: "Acknowledge Incident" })).toBeVisible();
expect(screen.getByLabelText("Publish Update")).toHaveAttribute("name", "note");
expect(screen.getByLabelText("Resolve Incident")).toHaveAttribute("name", "finalMessage");
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --run src/app/admin/incidents/[id]/page.test.tsx`

Expected: FAIL because `Incident overview` is not rendered.

- [ ] **Step 3: Wrap the page in `AdminShell` and add semantic sections**

Use `AdminShell` with incident service identity and a back-to-dashboard action. Replace legacy utility-only containers with `incident-detail`, `incident-overview`, `incident-facts`, `incident-actions`, and `incident-timeline` classes. Use existing `status-badge` classes for incident/update states and existing `.form-field`, `.button-primary`, and `.button-secondary` controls. Keep the existing server actions, labels, IDs, names, placeholder text, maxlengths, and conditional active-state behavior unchanged.

- [ ] **Step 4: Add scoped incident-detail CSS**

Add token-backed facts grid, action sections, timeline markers, state variants, and responsive stacking rules to `globals.css`. Do not alter public dashboard or admin-shell styles outside required shared class additions.

- [ ] **Step 5: Run the focused test to verify it passes**

Run: `npm test -- --run src/app/admin/incidents/[id]/page.test.tsx`

Expected: PASS.

### Task 2: Modernize the Public Service Detail

**Files:**
- Modify: `src/app/services/[slug]/page.tsx`
- Modify: `src/app/services/[slug]/page.test.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: `getServiceDetail`, `StatusBadge`, and `ServiceReportTrigger`.
- Produces: a service-detail masthead and responsive token-backed detail sections without changing report dialog wiring.

- [ ] **Step 1: Extend the existing service-detail test with visual hierarchy assertions**

Add assertions after rendering the existing fixture:

```tsx
expect(screen.getByText("WTG Downdetector")).toBeVisible();
expect(screen.getByText("Service detail")).toBeVisible();
expect(screen.getByRole("heading", { name: "Test Service" })).toBeVisible();
expect(screen.getByRole("heading", { name: "24-hour report trend" })).toBeVisible();
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --run src/app/services/[slug]/page.test.tsx`

Expected: FAIL because `Service detail` is not rendered.

- [ ] **Step 3: Implement the public service-detail hierarchy**

Replace the legacy bare `<header>` and `<article>` composition with a public masthead consistent with `/`, a `service-detail` page wrapper, identity/status header, metric strip, reporting action region, and token-backed content sections. Preserve `StatusBadge`, `ServiceReportTrigger`, all section headings, all service-data conditional rendering, and the 24-hour trend aria label.

- [ ] **Step 4: Add scoped public service-detail CSS**

Add `service-detail`, `service-detail-header`, `service-detail-metrics`, `service-detail-section`, `service-detail-list`, and `service-detail-incident` rules using existing design tokens. At `700px`, stack identity/metrics/actions and ensure the report button is reachable with no horizontal overflow.

- [ ] **Step 5: Run the focused test to verify it passes**

Run: `npm test -- --run src/app/services/[slug]/page.test.tsx`

Expected: PASS with the existing report trigger assertion and new hierarchy coverage.

### Task 3: Validate Detail Pages

**Files:**
- No source changes expected.

**Interfaces:**
- Consumes: local dev server and seeded `admin` / `admin` account.
- Produces: desktop and mobile visual evidence for detail-page hierarchy and actions.

- [ ] **Step 1: Inspect owner incident detail in desktop and mobile**

Use a seeded or test-reset incident, sign in as `admin` / `admin`, and inspect `/admin/incidents/[id]` at `1440x1000` and `390x844`. Verify the facts, acknowledge/update/resolve controls, and timeline have no overlap or clipping.

- [ ] **Step 2: Inspect public service detail in desktop and mobile**

Inspect `/services/jira` at `1440x1000` and `390x844`. Verify the masthead, service status, metrics, report action, trend, and incident sections fit without horizontal overflow.

- [ ] **Step 3: Run final validation**

Run: `npm run typecheck && npm run build`

Expected: both commands exit with code 0.
