# Public Dashboard Visual Refresh Design

## Goal

Modernize the public service-status dashboard into a calm operations console while preserving every existing data flow, route, accessibility label, and report interaction.

## Visual Direction

The page uses a light, paper-like surface with deep ink text, a restrained teal primary action color, and semantic green, amber, and red state signals. Typography gains a distinct display face for the product and page headings, paired with a highly legible sans-serif UI face.

The top bar becomes an operational masthead: product identity on the left and a concise availability indicator on the right. The dashboard heading establishes a compact, work-focused hierarchy, with the global report action remaining immediately available.

Search and category filters share a compact toolbar treatment. Category controls use a segmented-control appearance with a clear selected state. Service rows become scan-friendly panels that prioritize service identity, current state, report volume, historical activity, owner updates, and a direct report action. Responsive rules collapse row content into a predictable single-column layout without hiding functionality.

## Scope

- Update the public home page markup only where needed for the masthead and supporting operational context.
- Restyle the existing public dashboard, service rows, status badges, report triggers, and dialog through the established component classes.
- Retain all existing test IDs, accessible names, data loading, filtering, dialog behavior, and report submission behavior.
- Do not alter the admin console, service-detail page, APIs, or persistence model.

## Validation

- Extend or retain component tests to assert the public controls and state labels remain available.
- Run the focused public page/component tests and the production build.
- Inspect the dashboard in a desktop and mobile Playwright screenshot to verify hierarchy, spacing, and overflow.
