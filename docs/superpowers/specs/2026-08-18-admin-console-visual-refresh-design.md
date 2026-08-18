# Admin Console Visual Refresh Design

## Goal

Bring the owner login, incident dashboard, and service-management screens into the public dashboard's calm operations-console visual language without changing authentication, routes, server actions, field names, or data access.

## Visual Direction

Owner-facing pages use the public dashboard's paper surface, deep ink text, teal action color, monospaced operational labels, and semantic state colors. A shared owner-console masthead establishes identity, navigation, signed-in context, and logout. The login page becomes a deliberate console-entry surface rather than a generic centered card.

The owner dashboard prioritizes operational scanning: summary counts for active incidents, failed notifications, and recently resolved incidents lead into responsive data tables with compact state badges and direct action links. Service management uses the same shell and table treatment, with add/edit forms visually contained and responsive while preserving their existing server-action submissions.

## Scope

- Modernize `/admin/login`, `/admin`, and `/admin/services` presentation.
- Add a shared presentational admin shell or class contract where it reduces duplicated page chrome.
- Preserve all current labels, input names, test IDs, server actions, authorization checks, and routes.
- Keep incident-detail, public status pages, APIs, and persistence behavior out of scope.

## Validation

- Retain existing login, logout, and owner workflow tests; add focused structure assertions only where needed.
- Run focused owner-facing unit tests, typecheck, and production build.
- Inspect login, owner dashboard, and service management in desktop and mobile browser viewports.
