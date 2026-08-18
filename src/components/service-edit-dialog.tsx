"use client";

import { Pencil, X } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";

type EditActionState = {
  error?: string;
  success?: boolean;
};

type ServiceEditAction = (
  formData: FormData,
) => Promise<EditActionState>;

type ServiceEditDialogProps = Readonly<{
  service: Readonly<{
    id: string;
    name: string;
    category: string;
    baseUrl?: string;
    ownerEmail: string;
    thresholdCount: number;
    thresholdWindowMinutes: number;
    issueTypes: string[];
    enabled: boolean;
  }>;
  action: ServiceEditAction;
}>;

const issueTypes = [
  "UNAVAILABLE",
  "SLOW",
  "LOGIN",
  "CONNECTIVITY",
  "OTHER",
];

export function ServiceEditDialog({
  service,
  action,
}: ServiceEditDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(
    async (_previousState: EditActionState, formData: FormData) =>
      action(formData),
    {},
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  function closeDialog() {
    if (!isPending) setIsOpen(false);
  }

  return (
    <>
      <button
        type="button"
        className="icon-button"
        aria-label={`Edit ${service.name}`}
        title={`Edit ${service.name}`}
        onClick={() => setIsOpen(true)}
      >
        <Pencil size={16} aria-hidden="true" />
      </button>
      <dialog
        ref={dialogRef}
        className="service-edit-dialog"
        aria-labelledby={`edit-${service.id}-title`}
        onCancel={(event) => {
          event.preventDefault();
          closeDialog();
        }}
      >
        <form action={formAction} className="service-edit-dialog__form">
          <header className="dialog-header">
            <div>
              <p className="dialog-eyebrow">Service configuration</p>
              <h2 id={`edit-${service.id}-title`}>Edit {service.name}</h2>
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

          {state.error ? (
            <p className="error-message" role="alert">
              {state.error}
            </p>
          ) : null}

          <label className="toggle-option">
            <input
              type="checkbox"
              name="enabled"
              defaultChecked={service.enabled}
            />
            <span>Enabled</span>
          </label>

          <div className="form-field">
            <label htmlFor={`category-${service.id}`}>Category</label>
            <input
              id={`category-${service.id}`}
              type="text"
              name="category"
              defaultValue={service.category}
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor={`base-url-${service.id}`}>Base URL</label>
            <input
              id={`base-url-${service.id}`}
              type="text"
              name="baseUrl"
              defaultValue={service.baseUrl ?? ""}
              placeholder="https://status.example.com"
            />
          </div>
          <div className="form-field">
            <label htmlFor={`owner-email-${service.id}`}>Owner Email</label>
            <input
              id={`owner-email-${service.id}`}
              type="email"
              name="ownerEmail"
              defaultValue={service.ownerEmail}
              required
            />
          </div>
          <div className="form-grid-2">
            <div className="form-field">
              <label htmlFor={`threshold-count-${service.id}`}>
                Threshold Count
              </label>
              <input
                id={`threshold-count-${service.id}`}
                type="number"
                name="thresholdCount"
                defaultValue={service.thresholdCount}
                min="1"
                max="1000"
                required
              />
            </div>
            <div className="form-field">
              <label htmlFor={`threshold-window-${service.id}`}>
                Window (minutes)
              </label>
              <input
                id={`threshold-window-${service.id}`}
                type="number"
                name="thresholdWindowMinutes"
                defaultValue={service.thresholdWindowMinutes}
                min="1"
                max="1440"
                required
              />
            </div>
          </div>
          <fieldset className="issue-type-fieldset">
            <legend>Issue types</legend>
            <div className="issue-type-grid">
              {issueTypes.map((type) => (
                <label key={type} className="issue-type-option">
                  <input
                    type="checkbox"
                    name="issueTypes"
                    value={type}
                    defaultChecked={service.issueTypes.includes(type)}
                  />
                  <span>{type}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="dialog-actions">
            <button
              type="button"
              className="button-secondary"
              onClick={closeDialog}
              disabled={isPending}
            >
              Cancel
            </button>
            <button type="submit" className="button-primary" disabled={isPending}>
              {isPending ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
