import { HourlyReportBucket } from "@/modules/services/service-queries";

interface ServiceRowProps {
  name: string;
  slug: string;
  category: string;
  currentState: "OPERATIONAL" | "REPORTS_RISING" | "INCIDENT_CONFIRMED";
  reportCount: number;
  threshold: number;
  hourlyBuckets: HourlyReportBucket[];
  latestOwnerUpdate: string | null;
  latestOwnerUpdateAt: Date | null;
  onReportClick: () => void;
}

export function ServiceRow({
  name,
  currentState,
  reportCount,
  threshold,
  hourlyBuckets,
  latestOwnerUpdate,
  onReportClick,
}: ServiceRowProps) {
  // Calculate max count for scaling
  const maxCount = Math.max(...hourlyBuckets.map((b) => b.count), 1);

  return (
    <div className="service-row" data-testid={`service-row-${name}`}>
      <div className="service-info">
        <h3 className="service-name">{name}</h3>
        <StatusBadge state={currentState} />
        <div className="service-stats">
          {reportCount} / {threshold} reports
        </div>
      </div>

      {latestOwnerUpdate && (
        <div className="owner-update">
          <p>{latestOwnerUpdate}</p>
        </div>
      )}

      <div
        className="sparkline"
        role="img"
        aria-label={`24-hour report trend for ${name}`}
      >
        {hourlyBuckets.map((bucket, i) => {
          const heightPercent = maxCount > 0 ? (bucket.count / maxCount) * 100 : 0;
          return (
            <div
              key={i}
              className="sparkline-bar"
              style={{ height: `${heightPercent}%` }}
              aria-hidden="true"
            />
          );
        })}
      </div>

      <button
        className="report-button"
        onClick={onReportClick}
        aria-label={`Report a problem with ${name}`}
      >
        Report a problem
      </button>
    </div>
  );
}

function StatusBadge({ state }: { state: string }) {
  const config: Record<string, { label: string; className: string }> = {
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

  const { label, className } = config[state] || config.OPERATIONAL;

  return (
    <span className={`status-badge ${className}`} role="status" aria-label={label}>
      {label}
    </span>
  );
}
