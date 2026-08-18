interface StatusBadgeProps {
  state: "OPERATIONAL" | "REPORTS_RISING" | "INCIDENT_CONFIRMED";
}

export function StatusBadge({ state }: StatusBadgeProps) {
  const config = {
    OPERATIONAL: {
      label: "Operational",
      className: "bg-green-100 text-green-800",
    },
    REPORTS_RISING: {
      label: "Reports rising",
      className: "bg-amber-100 text-amber-800",
    },
    INCIDENT_CONFIRMED: {
      label: "Incident confirmed",
      className: "bg-red-100 text-red-800",
    },
  };

  const { label, className } = config[state];

  return (
    <span
      className={`inline-flex px-2 py-1 text-xs font-medium rounded ${className}`}
      role="status"
      aria-label={label}
    >
      {label}
    </span>
  );
}
