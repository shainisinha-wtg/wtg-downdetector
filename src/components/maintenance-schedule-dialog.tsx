"use client";

import { CalendarClock, X } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";

type MaintenanceActionState = {
  error?: string;
  success?: boolean;
};

type MaintenanceScheduleAction = (
  formData: FormData,
) => Promise<MaintenanceActionState>;

type MaintenanceScheduleDialogProps = Readonly<{
  service: Readonly<{ id: string; name: string }>;
  action: MaintenanceScheduleAction;
}>;

/** Converts a `datetime-local` value (browser local time) to a UTC ISO string. */
function toIsoOrEmpty(localValue: string): string {
  if (!localValue) return "";
  const parsed = new Date(localValue);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

export function MaintenanceScheduleDialog({
  service,
  action,
}: MaintenanceScheduleDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [state, formAction, isPending] = useActionState(
    async (_previousState: MaintenanceActionState, formData: FormData) =>
      action(formData),
    {},
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  useEffect(() => {
    if (state.success) setIsOpen(false);
  }, [state.success]);

  function closeDialog() {
    if (!isPending) setIsOpen(false);
  }

  function openDialog() {
    setTitle("");
    setDescription("");
    setStartsAt("");
    setEndsAt("");
    setIsOpen(true);
  }

  const rangeIsInvalid =
    Boolean(startsAt) && Boolean(endsAt) && new Date(endsAt) <= new Date(startsAt);

  return (
    <>
      <button
        type="button"
        className="button-secondary icon-text-button"
        onClick={openDialog}
        data-testid={`schedule-maintenance-${service.id}`}
      >
        <CalendarClock size={16} aria-hidden="true" />
        Maintenance
      </button>
      <dialog
        ref={dialogRef}
        className="service-edit-dialog"
        aria-labelledby={`maintenance-title-${service.id}`}
        onCancel={(event) => {
          event.preventDefault();
          closeDialog();
        }}
      >
        <form action={formAction} className="service-edit-dialog__form">
          <header className="dialog-header">
            <div>
              <p className="dialog-eyebrow">{service.name}</p>
              <h2 id={`maintenance-title-${service.id}`}>
                Schedule maintenance window
              </h2>
            </div>
            <button
              type="button"
              className="close-button"
              aria-label="Close dialog"
              title="Close dialog"
              onClick={closeDialog}
              disabled={isPending}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </header>

          {state.error && isOpen ? (
            <p className="error-message" role="alert">
              {state.error}
            </p>
          ) : null}

          <div className="form-field">
            <label htmlFor={`maintenance-summary-${service.id}`}>Summary</label>
            <input
              id={`maintenance-summary-${service.id}`}
              type="text"
              name="title"
              placeholder="Quarterly database upgrade"
              required
              maxLength={120}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>

          <div className="form-grid-2">
            <div className="form-field">
              <label htmlFor={`maintenance-start-${service.id}`}>Starts</label>
              <input
                id={`maintenance-start-${service.id}`}
                type="datetime-local"
                required
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
              />
            </div>
            <div className="form-field">
              <label htmlFor={`maintenance-end-${service.id}`}>Ends</label>
              <input
                id={`maintenance-end-${service.id}`}
                type="datetime-local"
                required
                min={startsAt || undefined}
                value={endsAt}
                onChange={(event) => setEndsAt(event.target.value)}
              />
            </div>
          </div>

          {rangeIsInvalid && (
            <p className="error-message" role="alert">
              End time must be after start time.
            </p>
          )}

          <div className="form-field">
            <label htmlFor={`maintenance-notes-${service.id}`}>
              Details (optional)
            </label>
            <textarea
              id={`maintenance-notes-${service.id}`}
              name="description"
              rows={3}
              maxLength={1000}
              placeholder="Expected impact, workarounds, contact..."
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <input type="hidden" name="serviceId" value={service.id} />
          <input type="hidden" name="startsAt" value={toIsoOrEmpty(startsAt)} />
          <input type="hidden" name="endsAt" value={toIsoOrEmpty(endsAt)} />

          <div className="dialog-actions">
            <button
              type="button"
              className="button-secondary"
              onClick={closeDialog}
              disabled={isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="button-primary"
              disabled={isPending || rangeIsInvalid}
            >
              {isPending ? "Scheduling..." : "Schedule window"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
