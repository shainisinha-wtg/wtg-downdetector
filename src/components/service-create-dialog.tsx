"use client";

import { Plus, X } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";

type CreateActionState = {
  error?: string;
  success?: boolean;
};

type ServiceCreateAction = (
  formData: FormData,
) => Promise<CreateActionState>;

type ServiceCreateDialogProps = Readonly<{
  action: ServiceCreateAction;
}>;

type CreateFormValues = {
  name: string;
  slug: string;
  category: string;
  baseUrl: string;
  ownerEmail: string;
  thresholdCount: string;
  thresholdWindowMinutes: string;
  issueTypes: string[];
};

const issueTypes = [
  "UNAVAILABLE",
  "SLOW",
  "LOGIN",
  "CONNECTIVITY",
  "OTHER",
];

const initialValues: CreateFormValues = {
  name: "",
  slug: "",
  category: "",
  baseUrl: "",
  ownerEmail: "",
  thresholdCount: "10",
  thresholdWindowMinutes: "10",
  issueTypes: ["UNAVAILABLE"],
};

function normalizeSlug(value: string): string {
  let normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  while (normalized.startsWith("-")) normalized = normalized.slice(1);
  while (normalized.endsWith("-")) normalized = normalized.slice(0, -1);
  return normalized;
}

export function ServiceCreateDialog({ action }: ServiceCreateDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [values, setValues] = useState(initialValues);
  const [state, formAction, isPending] = useActionState(
    async (_previousState: CreateActionState, formData: FormData) =>
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

  function openDialog() {
    setValues(initialValues);
    setIsOpen(true);
  }

  function updateValue(name: keyof Omit<CreateFormValues, "issueTypes">, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  function updateName(value: string) {
    setValues((current) => ({
      ...current,
      name: value,
      slug: normalizeSlug(value),
    }));
  }

  return (
    <>
      <button
        type="button"
        className="button-primary icon-text-button"
        onClick={openDialog}
      >
        <Plus size={16} aria-hidden="true" />
        Add service
      </button>
      <dialog
        ref={dialogRef}
        className="service-edit-dialog service-create-dialog"
        aria-labelledby="create-service-title"
        onCancel={(event) => {
          event.preventDefault();
          closeDialog();
        }}
      >
        <form action={formAction} className="service-edit-dialog__form">
          <header className="dialog-header">
            <div>
              <p className="dialog-eyebrow">Service configuration</p>
              <h2 id="create-service-title">Add service</h2>
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
            <label htmlFor="create-service-name">Name</label>
            <input
              id="create-service-name"
              type="text"
              name="name"
              placeholder="Jira"
              required
              value={values.name}
              onChange={(event) => updateName(event.target.value)}
            />
            <input type="hidden" name="slug" value={values.slug} />
          </div>
          <div className="form-field">
            <label htmlFor="create-service-category">Category</label>
            <input
              id="create-service-category"
              type="text"
              name="category"
              placeholder="Developer Tools"
              required
              value={values.category}
              onChange={(event) => updateValue("category", event.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="create-service-base-url">Base URL</label>
            <input
              id="create-service-base-url"
              type="text"
              name="baseUrl"
              placeholder="https://status.example.com"
              value={values.baseUrl}
              onChange={(event) => updateValue("baseUrl", event.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="create-service-owner-email">Owner email</label>
            <input
              id="create-service-owner-email"
              type="email"
              name="ownerEmail"
              placeholder="jira-owners@example.internal"
              required
              value={values.ownerEmail}
              onChange={(event) => updateValue("ownerEmail", event.target.value)}
            />
          </div>
          <div className="form-grid-2">
            <div className="form-field">
              <label htmlFor="create-threshold-count">Threshold</label>
              <input
                id="create-threshold-count"
                type="number"
                name="thresholdCount"
                value={values.thresholdCount}
                min="1"
                max="1000"
                required
                onChange={(event) =>
                  updateValue("thresholdCount", event.target.value)
                }
              />
            </div>
            <div className="form-field">
              <label htmlFor="create-threshold-window">Window (minutes)</label>
              <input
                id="create-threshold-window"
                type="number"
                name="thresholdWindowMinutes"
                value={values.thresholdWindowMinutes}
                min="1"
                max="1440"
                required
                onChange={(event) =>
                  updateValue("thresholdWindowMinutes", event.target.value)
                }
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
                    checked={values.issueTypes.includes(type)}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        issueTypes: event.target.checked
                          ? [...current.issueTypes, type]
                          : current.issueTypes.filter((item) => item !== type),
                      }))
                    }
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
              {isPending ? "Creating..." : "Create service"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
