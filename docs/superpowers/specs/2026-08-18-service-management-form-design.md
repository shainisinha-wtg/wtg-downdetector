# Service Management Form Design

## Scope

Improve the admin service editor by making issue-type selection readable, collapsing the editor after a successful save, and adding an optional plain-text base URL while keeping the database field present for every service.

## Design

- Render issue types as a consistently spaced two-column checkbox grid in both create and edit forms.
- Replace the edit `<details>` popover with a centered native dialog opened by an accessible pencil icon button. Keep create as a compact popover.
- Redirect to `/admin/services` after successful create or update. This refreshes the service list and closes the edit dialog. Failed actions remain in the dialog.
- Add `Service.baseUrl` as a non-null string with a default empty string. Existing rows migrate to `""`.
- Add an optional text input named `baseUrl` to create and edit forms and pass it through the existing service action validation and persistence.

## Verification

- Existing service form tests continue to pass.
- Typecheck passes.
- The admin services page shows the new base URL field, uses the readable issue-type layout, and closes after a successful save.
