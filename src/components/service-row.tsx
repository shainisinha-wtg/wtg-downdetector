import { HourlyReportBucket, OwnerUpdate } from "@/modules/services/service-queries";
import { StatusBadge } from "./status-badge";

type ServiceRowProps = Readonly<{
  name: string;
  category: string;
  currentState: "OPERATIONAL" | "REPORTS_RISING" | "INCIDENT_CONFIRMED";
  reportCount: number;
  hourlyBuckets: HourlyReportBucket[];
  latestOwnerUpdate: string | null;
  latestOwnerUpdateAt: Date | null;
  ownerUpdates: OwnerUpdate[];
  onReportClick: () => void;
}>;

export function ServiceRow({
  name,
  category,
  currentState,
  reportCount,
  hourlyBuckets,
  latestOwnerUpdate,
  latestOwnerUpdateAt,
  ownerUpdates,
  onReportClick,
}: ServiceRowProps) {
  // Calculate max count for scaling
  const maxCount = Math.max(...hourlyBuckets.map((b) => b.count), 1);

  return (
    <div className="service-row" data-testid={`service-row-${name}`}>
      <div className="service-info">
        <div>
          <p className="service-category">{category}</p>
          <h3 className="service-name">{name}</h3>
        </div>
        <StatusBadge state={currentState} />
        <div className="service-stats">
          <strong>{reportCount}</strong> reports
        </div>
      </div>

      {latestOwnerUpdate && (
        <div className="owner-update">
          <p>{latestOwnerUpdate}</p>
          {latestOwnerUpdateAt && (
            <time
              dateTime={latestOwnerUpdateAt.toISOString()}
              suppressHydrationWarning
            >
              {latestOwnerUpdateAt.toLocaleString()}
            </time>
          )}
          {ownerUpdates.length > 1 && (
            <details className="owner-update-history">
              <summary>View update history ({ownerUpdates.length})</summary>
              <div className="owner-update-list">
                {ownerUpdates.map((update) => (
                  <div
                    key={`${update.updatedAt.toISOString()}-${update.message}`}
                    className="owner-update-item"
                  >
                    <p>{update.message}</p>
                    <time
                      dateTime={update.updatedAt.toISOString()}
                      suppressHydrationWarning
                    >
                      {update.updatedAt.toLocaleString()}
                    </time>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      <div className="service-activity">
        <div
          className="sparkline"
          role="img"
          aria-label={`24-hour report trend for ${name}`}
        >
          {hourlyBuckets.map((bucket) => {
            const heightPercent = maxCount > 0 ? (bucket.count / maxCount) * 100 : 0;
            return (
              <div
                key={`${bucket.hour}-${bucket.count}-${hourlyBuckets.indexOf(bucket)}`}
                className="sparkline-bar"
                style={{ height: `${heightPercent}%` }}
                aria-hidden="true"
              />
            );
          })}
        </div>

        <button
          type="button"
          className="report-button"
          onClick={onReportClick}
          aria-label={`Report a problem with ${name}`}
        >
          Report a problem
        </button>
      </div>
    </div>
  );
}
