interface StatusBadgeProps {
  state: "OPERATIONAL" | "REPORTS_RISING" | "INCIDENT_CONFIRMED";
}

export function StatusBadge({ state }: StatusBadgeProps) {
  const config = {
    OPERATIONAL: {
      label: "Operational",
      className: "badge-green",
    },
    REPORTS_RISING: {
      label: "Reports rising",
      className: "badge-amber",
    },
    INCIDENT_CONFIRMED: {
      label: "Incident confirmed",
      className: "badge-red",
    },
  };

  const { label, className } = config[state];

  return (
    <span
      className={`status-badge ${className}`}
      role="status"
      aria-label={label}
    >
      {label}
    </span>
  );
}
