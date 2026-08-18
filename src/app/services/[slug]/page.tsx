import { notFound } from "next/navigation";
import { getServiceDetail } from "@/modules/services/service-queries";
import { StatusBadge } from "@/components/status-badge";
import { ServiceReportTrigger } from "@/components/service-report-trigger";

export const dynamic = "force-dynamic";

interface ServicePageProps {
  params: Promise<{ slug: string }>;
}

export default async function ServicePage({ params }: ServicePageProps) {
  const { slug } = await params;
  const service = await getServiceDetail(slug);

  if (!service) {
    notFound();
  }

  const maxBucketCount = Math.max(...service.hourlyBuckets.map((b) => b.count), 1);

  return (
    <main>
      <header>
        <strong>WTG Downdetector</strong>
      </header>

      <article>
        <div className="service-header">
          <h1>{service.name}</h1>
          <StatusBadge
            state={
              service.currentState as
                | "OPERATIONAL"
                | "REPORTS_RISING"
                | "INCIDENT_CONFIRMED"
            }
          />
        </div>

        <div className="service-meta">
          <span className="category">{service.category}</span>
          <span className="report-count">
            {service.reportCount} / {service.threshold} reports
          </span>
        </div>

        <ServiceReportTrigger
          serviceId={service.id}
          serviceName={service.name}
          issueTypes={service.issueTypes}
        />

        {service.latestOwnerUpdate && (
          <div className="owner-update">
            <h2>Latest update</h2>
            <p>{service.latestOwnerUpdate}</p>
            {service.latestOwnerUpdateAt && (
              <time dateTime={new Date(service.latestOwnerUpdateAt).toISOString()}>
                {new Date(service.latestOwnerUpdateAt).toLocaleString()}
              </time>
            )}
          </div>
        )}

        <section>
          <h2>24-hour report trend</h2>
          <div
            className="sparkline"
            role="img"
            aria-label="24-hour report trend"
          >
            {service.hourlyBuckets.map((bucket, i) => {
              const heightPercent =
                maxBucketCount > 0 ? (bucket.count / maxBucketCount) * 100 : 0;
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
        </section>

        {service.issueBreakdown.length > 0 && (
          <section>
            <h2>Issue breakdown</h2>
            <ul>
              {service.issueBreakdown.map((issue) => (
                <li key={issue.issueType}>
                  {formatIssueType(issue.issueType)}: {issue.count} reports
                </li>
              ))}
            </ul>
          </section>
        )}

        {service.activeIncident && (
          <section>
            <h2>Active incident</h2>
            <div className="incident-card">
              <p>
                Opened: {new Date(service.activeIncident.openedAt).toLocaleString()}
              </p>
              <p>Report count at opening: {service.activeIncident.reportCount}</p>
              {service.activeIncident.latestUpdate && (
                <div className="incident-update">
                  <p>{service.activeIncident.latestUpdate}</p>
                  {service.activeIncident.latestUpdateAt && (
                    <time
                      dateTime={new Date(
                        service.activeIncident.latestUpdateAt
                      ).toISOString()}
                    >
                      {new Date(
                        service.activeIncident.latestUpdateAt
                      ).toLocaleString()}
                    </time>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {service.recentResolvedIncidents.length > 0 && (
          <section>
            <h2>Recent resolved incidents</h2>
            {service.recentResolvedIncidents.map((incident) => (
              <div key={incident.id} className="incident-card">
                <p>
                  Resolved:{" "}
                  {incident.resolvedAt &&
                    new Date(incident.resolvedAt).toLocaleString()}
                </p>
                {incident.latestUpdate && <p>{incident.latestUpdate}</p>}
              </div>
            ))}
          </section>
        )}
      </article>
    </main>
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
