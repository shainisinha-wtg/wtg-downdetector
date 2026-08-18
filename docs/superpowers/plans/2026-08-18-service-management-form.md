# Service Management Form Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the admin service form with readable issue-type controls, successful-save collapse, and a persisted optional base URL.

**Architecture:** Keep the create form server-rendered as a `<details>` popover, but move edit state into a small client-side native dialog component. Add `baseUrl` to the Prisma model and owner-management input contracts, then redirect after successful service mutations so the page reload closes the editor. Use the existing CSS patterns for a centered dialog and two-column issue-type grid.

**Tech Stack:** Next.js 15, React 19, Prisma 6, PostgreSQL, Zod, Vitest.

## Global Constraints

- `baseUrl` is a non-null database string with default `""`.
- The admin base URL input is plain text and is not HTML-required.
- Failed mutations must continue returning an error rather than redirecting.
- Existing service behavior and public APIs remain unchanged.

---

### Task 1: Add Base URL To The Data Contract

**Files:**
- Create: `prisma/migrations/20260818120000_add_service_base_url/migration.sql`
- Modify: `prisma/schema.prisma`
- Modify: `src/modules/admin/owner-management.ts`
- Modify: `src/app/admin/actions.ts`
- Test: `src/modules/services/service-update-audit.integration.test.ts`

- [ ] **Step 1: Add the migration and Prisma field**

Add `baseUrl String @default("")` to `Service` and create a migration containing:

```sql
ALTER TABLE "Service" ADD COLUMN "baseUrl" TEXT NOT NULL DEFAULT '';
```

- [ ] **Step 2: Extend service input schemas and persistence**

Add `baseUrl: z.string().trim().max(2048)` to the shared service schema. Add `baseUrl: string` to both owner-management interfaces, pass it to `service.create`, update it in `service.update`, and include it in audit metadata before and after snapshots.

- [ ] **Step 3: Extend the integration assertion**

Update the existing service update/create test inputs to include `baseUrl`, then assert the persisted service has the supplied value and the update audit metadata records it.

- [ ] **Step 4: Run the focused integration test**

Run:

```bash
DATABASE_URL="postgresql://wtg:wtg_local_test@127.0.0.1:55432/wtg_downdetector" DIRECT_URL="postgresql://wtg:wtg_local_test@127.0.0.1:55432/wtg_downdetector" npm run test:integration -- src/modules/services/service-update-audit.integration.test.ts
```

Expected: PASS after applying the migration to the local test database.

### Task 2: Update The Admin Forms And Save Navigation

**Files:**
- Modify: `src/app/admin/services/page.tsx`
- Modify: `src/app/admin/actions.ts`

- [ ] **Step 1: Add the centered edit dialog and base URL controls**

Create `src/components/service-edit-dialog.tsx` as a client component using a native `<dialog>`, a `Pencil` trigger, and the existing server action as its form action. Add a plain text `baseUrl` input to the dialog and `CreateServiceForm`, defaulting to the service value for edits and an empty value for creates. Include `baseUrl: formData.get("baseUrl")` in both server-action payloads.

- [ ] **Step 2: Make issue types readable**

Use a semantic `fieldset` and `legend` in the dialog, matching the create form’s two-column grid. Give each checkbox row consistent spacing and prevent the labels from running together.

- [ ] **Step 3: Collapse after successful mutation**

In `createService` and `updateService`, call `redirect("/admin/services")` immediately after successful revalidation. Keep the existing error returns in the catch branches so validation or persistence errors leave the form open.

- [ ] **Step 4: Run UI tests and typecheck**

Run:

```bash
npm test -- --run src/app/admin/services/page.test.tsx
npm run typecheck
```

Expected: the focused page test and typecheck pass.

### Task 3: Validate The Browser Workflow

**Files:**
- Modify: `src/app/admin/services/page.test.tsx` if an existing test file needs assertions.

- [ ] **Step 1: Verify the rendered controls**

Open `/admin/services` and confirm the edit form shows a readable two-column issue-type grid and an unlabeled-required `Base URL` text input.

- [ ] **Step 2: Verify successful save behavior**

Change the base URL or issue types, submit `Save Changes`, and confirm the page returns to `/admin/services` with the editor collapsed and the updated values visible when reopened.

- [ ] **Step 3: Verify empty base URL behavior**

Create or edit a service with an empty base URL and confirm submission succeeds and the database stores an empty string.
