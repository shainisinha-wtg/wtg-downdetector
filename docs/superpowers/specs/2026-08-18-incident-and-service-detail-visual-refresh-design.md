# Incident and Service Detail Visual Refresh Design

## Goal

Modernize the remaining legacy route surfaces: the owner incident detail page and the public service-detail page. Preserve every data query, route, authorization check, action, report workflow, and existing form contract.

## Visual Direction

The owner incident page adopts the shared operations-console shell, with service identity and incident state in a compact masthead, an at-a-glance fact grid, clearly separated acknowledge/update/resolve controls, and an operational timeline.

The public service-detail page adopts the public dashboard masthead and paper/ink/teal visual system. Status, report pressure, owner updates, reporting action, activity trend, issue breakdown, active incident, and resolved history become readable, responsive sections designed for fast status assessment.

## Scope

- Modernize `/admin/incidents/[id]` using the existing `AdminShell` and token-backed CSS classes.
- Modernize `/services/[slug]` using the existing public dashboard visual language.
- Preserve existing labels, textareas, field names, report trigger behavior, action routes, and data loading.
- Keep login, owner dashboard, service management, public dashboard, APIs, and persistence behavior out of scope.

## Validation

- Retain the existing service-detail report-trigger test and add focused structure coverage where necessary.
- Run focused tests, typecheck, and production build.
- Inspect both pages at desktop and mobile viewport sizes, confirming no clipped text or obscured action controls.
