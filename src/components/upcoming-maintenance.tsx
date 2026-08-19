import { CalendarClock } from "lucide-react";
import { MaintenanceWindowSummary } from "@/modules/maintenance/maintenance-windows";

type UpcomingMaintenanceProps = Readonly<{
  windows: MaintenanceWindowSummary[];
}>;

function formatRange(startsAt: Date, endsAt: Date): string {
  const sameDay = startsAt.toDateString() === endsAt.toDateString();
  const start = startsAt.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const end = endsAt.toLocaleString(
    [],
    sameDay
      ? { hour: "2-digit", minute: "2-digit" }
      : { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" },
  );
  return `${start} – ${end}`;
}

export function UpcomingMaintenance({ windows }: UpcomingMaintenanceProps) {
  return (
    <section className="maintenance-panel" data-testid="upcoming-maintenance">
      <div className="maintenance-panel__header">
        <CalendarClock size={18} aria-hidden="true" />
        <div>
          <p className="dashboard-kicker">Planned work</p>
          <h2>Upcoming maintenance</h2>
        </div>
      </div>

      {windows.length === 0 ? (
        <p className="maintenance-empty">
          No maintenance windows are scheduled right now.
        </p>
      ) : (
        <ul className="maintenance-list">
          {windows.map((window) => (
            <li key={window.id} className="maintenance-item">
              <div className="maintenance-item__head">
                <strong>{window.serviceName}</strong>
                <span
                  className={`status-badge ${
                    window.inProgress ? "badge-amber" : "badge-green"
                  }`}
                >
                  {window.inProgress ? "In progress" : "Scheduled"}
                </span>
              </div>
              <p className="maintenance-item__title">{window.title}</p>
              <time
                dateTime={window.startsAt.toISOString()}
                suppressHydrationWarning
              >
                {formatRange(
                  new Date(window.startsAt),
                  new Date(window.endsAt),
                )}
              </time>
              {window.description && (
                <p className="maintenance-item__note">{window.description}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
