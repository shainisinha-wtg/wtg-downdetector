import { notFound } from "next/navigation";
import { getServiceDetail } from "@/modules/services/service-queries";
import { StatusBadge } from "@/components/status-badge";
import { ServiceReportTrigger } from "@/components/service-report-trigger";

export const dynamic = "force-dynamic";

interface ServicePageProps {
  params: Promise<{ slug: string }>;
}

export default async function ServicePage({ params }: Readonly<ServicePageProps>) {
  const { slug } = await params;
  const service = await getServiceDetail(slug);

  if (!service) {
    notFound();
  }

  const maxBucketCount = Math.max(...service.hourlyBuckets.map((bucket) => bucket.count), 1);

  return (
    <>
      <header className="site-header">
        <div className="site-header__brand">
          <strong>WTG Downdetector</strong>
          <span>Internal service monitor</span>
        </div>
        <div className="site-header__status">
          <span className="site-header__status-dot" aria-hidden="true" />
          <span>Service detail</span>
        </div>
      </header>

      <main className="service-detail">
        <article>
          <header className="service-detail-header">
            <div>
              <p className="dashboard-kicker">{service.category}</p>
              <h1>{service.name}</h1>
            </div>
            <StatusBadge state={service.currentState as "OPERATIONAL" | "REPORTS_RISING" | "INCIDENT_CONFIRMED"} />
          </header>

          <div className="service-detail-metrics">
            <div>
              <span>Reports in window</span>
              <strong>{service.reportCount} / {service.threshold}</strong>
            </div>
            <div>
              <span>Current status</span>
              <strong>{service.currentState.replaceAll("_", " ")}</strong>
            </div>
          </div>

          <div className="service-detail-action">
            <ServiceReportTrigger serviceId={service.id} serviceName={service.name} issueTypes={service.issueTypes} />
          </div>

          {service.latestOwnerUpdate && (
            <section className="service-detail-section owner-update">
              <h2>Latest update</h2>
              <p>{service.latestOwnerUpdate}</p>
              {service.latestOwnerUpdateAt && (
                <time dateTime={new Date(service.latestOwnerUpdateAt).toISOString()}>
                  {new Date(service.latestOwnerUpdateAt).toLocaleString()}
                </time>
              )}
            </section>
          )}

          <section className="service-detail-section">
            <h2>24-hour report trend</h2>
            <div className="sparkline" role="img" aria-label="24-hour report trend">
              {service.hourlyBuckets.map((bucket) => (
                <div
                  key={bucket.hour}
                  className="sparkline-bar"
                  style={{ height: `${(bucket.count / maxBucketCount) * 100}%` }}
                  aria-hidden="true"
                />
              ))}
            </div>
          </section>

          {service.issueBreakdown.length > 0 && (
            <section className="service-detail-section">
              <h2>Issue breakdown</h2>
              <ul className="service-detail-list">
                {service.issueBreakdown.map((issue) => (
                  <li key={issue.issueType}>
                    <span>{formatIssueType(issue.issueType)}</span>
                    <strong>{issue.count} reports</strong>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {service.activeIncident && (
            <section className="service-detail-section">
              <h2>Active incident</h2>
              <IncidentCard
                openedAt={service.activeIncident.openedAt}
                reportCount={service.activeIncident.reportCount}
                latestUpdate={service.activeIncident.latestUpdate}
                latestUpdateAt={service.activeIncident.latestUpdateAt}
              />
            </section>
          )}

          {service.recentResolvedIncidents.length > 0 && (
            <section className="service-detail-section">
              <h2>Recent resolved incidents</h2>
              <div className="service-detail-resolved">
                {service.recentResolvedIncidents.map((incident) => (
                  <div key={incident.id} className="service-detail-incident">
                    <p>Resolved: {incident.resolvedAt && new Date(incident.resolvedAt).toLocaleString()}</p>
                    {incident.latestUpdate && <p>{incident.latestUpdate}</p>}
                  </div>
                ))}
              </div>
            </section>
          )}
        </article>
      </main>
    </>
  );
}

function IncidentCard({
  openedAt,
  reportCount,
  latestUpdate,
  latestUpdateAt,
}: Readonly<{
  openedAt: Date | string;
  reportCount: number;
  latestUpdate: string | null;
  latestUpdateAt: Date | string | null;
}>) {
  return (
    <div className="service-detail-incident">
      <p>Opened: {new Date(openedAt).toLocaleString()}</p>
      <p>Report count at opening: {reportCount}</p>
      {latestUpdate && (
        <div className="incident-update">
          <p>{latestUpdate}</p>
          {latestUpdateAt && <time dateTime={new Date(latestUpdateAt).toISOString()}>{new Date(latestUpdateAt).toLocaleString()}</time>}
        </div>
      )}
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
