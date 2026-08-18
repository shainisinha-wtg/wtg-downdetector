# Admin Console Visual Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modernize owner login, incident operations, and service management while preserving all owner workflows.

**Architecture:** Keep each existing route server-rendered and retain its current actions, queries, and authorization. Introduce a small shared presentational shell for signed-in owner pages and extend `globals.css` with owner-console classes built from the existing public-dashboard design tokens.

**Tech Stack:** Next.js 15, React 19, TypeScript, Vitest, Testing Library, Lucide React, CSS.

## Global Constraints

- Preserve `/admin/login`, `/admin`, and `/admin/services` routes, auth behavior, input names, and server actions.
- Preserve existing owner incident, service creation, service edit, retry, and logout controls.
- Reuse the existing paper, ink, teal, semantic-status, and typography tokens from `src/app/globals.css`.
- Keep desktop tables readable and provide a no-overflow mobile presentation.

---

### Task 1: Protect Owner Console Entry and Navigation

**Files:**
- Create: `src/app/admin/login/page.test.tsx`
- Modify: `src/app/admin/login/page.tsx`
- Create: `src/components/admin-shell.tsx`

**Interfaces:**
- Consumes: `AdminLoginPage`, `LogoutButton`, and Next.js `Link`.
- Produces: `AdminShell({ title, description, children, actions? })` for signed-in owner pages and a login page that retains `#username` and `#password`.

- [ ] **Step 1: Write the failing login structure test**

```tsx
it("identifies the owner operations console", () => {
  render(<AdminLoginPage />);

  expect(screen.getByText("WTG Downdetector")).toBeVisible();
  expect(screen.getByText("Owner operations console")).toBeVisible();
  expect(screen.getByLabelText("Username")).toHaveAttribute("id", "username");
  expect(screen.getByLabelText("Password")).toHaveAttribute("id", "password");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --run src/app/admin/login/page.test.tsx`

Expected: FAIL because the product identity and owner-console label are absent.

- [ ] **Step 3: Implement the shared shell and login masthead**

Create `AdminShell` with a product identity, page title/description, optional action region, and `admin-shell` class contract. Update the login page to present the product identity, `Owner operations console`, and the existing username/password form inside `admin-login` classes. Keep `handleSubmit` unchanged.

- [ ] **Step 4: Run the login test to verify it passes**

Run: `npm test -- --run src/app/admin/login/page.test.tsx`

Expected: PASS.

### Task 2: Modernize Owner Dashboard and Service Management

**Files:**
- Modify: `src/app/admin/page.tsx`
- Modify: `src/app/admin/services/page.tsx`
- Modify: `src/components/logout-button.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: `AdminShell`, existing `requireAdmin`, Prisma queries, server actions, and `LogoutButton`.
- Produces: owner dashboard summary counts, consistent owner tables, responsive action regions, and contained service add/edit forms without API changes.

- [ ] **Step 1: Wrap signed-in pages in the shared shell**

Use `AdminShell` for dashboard and service management. Pass the signed-in identity and `LogoutButton` as dashboard actions. Retain the existing `Link` destinations and all server-action form handlers.

- [ ] **Step 2: Add operational hierarchy and count summaries**

In the owner dashboard, add three non-interactive summaries before the incident table:

```tsx
<div className="admin-summary-grid">
  <div><span>Active incidents</span><strong>{openIncidents.length}</strong></div>
  <div><span>Failed notifications</span><strong>{failedNotifications.length}</strong></div>
  <div><span>Recently resolved</span><strong>{recentResolved.length}</strong></div>
</div>
```

Keep the existing table columns, state labels, and management links.

- [ ] **Step 3: Add owner-console CSS**

Extend `globals.css` with `admin-login`, `admin-shell`, `admin-topbar`, `admin-summary-grid`, `admin-table-wrap`, `admin-table`, `admin-empty-state`, and `admin-form-popover` classes. Use 8px-or-less corners, teal for direct commands, semantic state colors, and `overflow-x: auto` table wrappers. At `700px`, stack shell actions, make action buttons full-width where needed, and preserve table access through horizontal scrolling rather than clipping content.

- [ ] **Step 4: Run behavior regressions**

Run: `npm test -- --run src/components/logout-button.test.tsx src/components/service-dashboard.test.tsx`

Expected: PASS, confirming the shared controls retain logout and report behavior.

### Task 3: Validate Owner Surfaces

**Files:**
- No source changes expected.

**Interfaces:**
- Consumes: local Next.js server with seeded `admin` / `admin` account.
- Produces: visual evidence for the owner login, dashboard, and service management pages.

- [ ] **Step 1: Start the local app with the local test database**

Run:

```bash
PORT=3200 E2E_TEST_MODE=1 E2E_RESET_SECRET='local-e2e-reset-secret-at-least-32-bytes' DATABASE_URL='postgresql://wtg:wtg_local_test@127.0.0.1:55432/wtg_downdetector' DIRECT_URL='postgresql://wtg:wtg_local_test@127.0.0.1:55432/wtg_downdetector' REPORTER_HMAC_SECRET='local-reporter-hmac-secret-at-least-32-bytes' SESSION_SECRET='local-session-secret-at-least-32-bytes' npm run dev
```

Expected: the app is available at `http://localhost:3200`.

- [ ] **Step 2: Inspect desktop and mobile owner routes**

Sign in as `admin` / `admin`. Capture `/admin/login`, `/admin`, and `/admin/services` at `1440x1000` and `390x844`. Confirm all headings, action controls, table columns, and forms remain visible without overlap or clipped text.

- [ ] **Step 3: Run final static validation**

Run: `npm run typecheck && npm run build`

Expected: both commands exit with code 0.
