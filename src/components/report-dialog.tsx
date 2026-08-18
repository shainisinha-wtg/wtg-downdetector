"use client";

import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";

interface ReportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  services: Array<{ id: string; name: string; issueTypes: string[] }>;
  preselectedServiceId?: string;
}

interface FormState {
  serviceId: string;
  issueType: string;
  note: string;
}

export function ReportDialog({
  isOpen,
  onClose,
  services,
  preselectedServiceId,
}: ReportDialogProps) {
  const [formState, setFormState] = useState<FormState>({
    serviceId: preselectedServiceId || "",
    issueType: "",
    note: "",
  });

  // Update serviceId when preselectedServiceId changes
  useEffect(() => {
    if (preselectedServiceId) {
      setFormState((prev) => ({
        ...prev,
        serviceId: preselectedServiceId,
      }));
    }
  }, [preselectedServiceId]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const selectedService = services.find((s) => s.id === formState.serviceId);
  const availableIssueTypes = selectedService?.issueTypes ?? [];

  // Escape key handler
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, onClose]);

  // Focus management
  useEffect(() => {
    if (isOpen) {
      // Save current focus
      previousFocusRef.current = document.activeElement as HTMLElement;

      // Move focus into dialog
      setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 0);

      // Return cleanup to restore focus
      return () => {
        if (previousFocusRef.current) {
          previousFocusRef.current.focus();
        }
      };
    }
  }, [isOpen]);

  // Focus trap
  useEffect(() => {
    const handleTab = (e: KeyboardEvent) => {
      if (!isOpen || e.key !== "Tab" || !dialogRef.current) return;

      const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        // Shift+Tab: if at first element, wrap to last
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab: if at last element, wrap to first
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleTab);
      return () => document.removeEventListener("keydown", handleTab);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: formState.serviceId,
          issueType: formState.issueType,
          note: formState.note || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        if (data.code === "DUPLICATE_REPORT") {
          setError(
            "You've already reported this service recently. Please try again later.",
          );
        } else if (data.code === "RATE_LIMITED") {
          setError("Too many reports. Please try again in a moment.");
        } else {
          setError("Failed to submit report. Please try again.");
        }
        setIsSubmitting(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setFormState({ serviceId: "", issueType: "", note: "" });
      }, 2000);
    } catch {
      setError("Network error. Please check your connection and try again.");
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  if (success) {
    return (
      <div
        className="dialog-overlay"
        data-testid="report-dialog"
        onClick={onClose}
      >
        <div
          className="dialog-content"
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-success-title"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="success-message" data-testid="report-receipt">
            <h2 id="report-success-title">Report submitted</h2>
            <p>Thank you for reporting. We&apos;ll notify the service team.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="dialog-overlay"
      data-testid="report-dialog"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        className="dialog-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog-header">
          <h2 id="report-dialog-title">Report a problem</h2>
          <button
            ref={closeButtonRef}
            className="close-button"
            onClick={onClose}
            aria-label="Close dialog"
            data-testid="close-dialog"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="service">Service</label>
            <select
              id="service"
              value={formState.serviceId}
              onChange={(e) =>
                setFormState({
                  ...formState,
                  serviceId: e.target.value,
                  issueType: "",
                })
              }
              required
              data-testid="service-select"
            >
              <option value="">Select a service</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="issueType">Issue type</label>
            <select
              id="issueType"
              value={formState.issueType}
              onChange={(e) =>
                setFormState({ ...formState, issueType: e.target.value })
              }
              required
              disabled={!formState.serviceId}
              data-testid="issue-type-select"
            >
              <option value="">Select an issue type</option>
              {availableIssueTypes.map((type) => (
                <option key={type} value={type}>
                  {formatIssueType(type)}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="note">Note (optional)</label>
            <textarea
              id="note"
              value={formState.note}
              onChange={(e) =>
                setFormState({ ...formState, note: e.target.value })
              }
              maxLength={500}
              rows={3}
              placeholder="Additional details..."
              data-testid="note-textarea"
            />
            <div className="character-count">{formState.note.length} / 500</div>
          </div>

          {error && (
            <div
              className="error-message"
              role="alert"
              data-testid="error-message"
            >
              {error}
            </div>
          )}

          <div className="dialog-actions">
            <button
              type="button"
              onClick={onClose}
              className="button-secondary"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="button-primary"
              disabled={
                isSubmitting || !formState.serviceId || !formState.issueType
              }
              data-testid="submit-report"
            >
              {isSubmitting ? "Submitting..." : "Submit report"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function formatIssueType(type: string): string {
  const formatted: Record<string, string> = {
    UNAVAILABLE: "Unavailable",
    SLOW: "Slow",
    LOGIN: "Login issues",
    CONNECTIVITY: "Connectivity issues",
    OTHER: "Other",
  };
  return formatted[type] || type;
}
