import { requireAdmin } from "@/modules/auth/require-admin";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";

export default async function AdminDashboardPage() {
  const admin = await requireAdmin();

  // Fetch open incidents
  const openIncidents = await prisma.incident.findMany({
    where: {
      state: { in: ["OPEN", "ACKNOWLEDGED"] },
    },
    include: {
      service: true,
      updates: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { openedAt: "desc" },
  });

  // Fetch recent resolved incidents
  const recentResolved = await prisma.incident.findMany({
    where: {
      state: "RESOLVED",
    },
    include: {
      service: true,
    },
    orderBy: { resolvedAt: "desc" },
    take: 10,
  });

  // Fetch failed notifications
  const failedNotifications = await prisma.notificationJob.findMany({
    where: {
      state: "FAILED",
    },
    include: {
      incident: {
        include: {
          service: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });

  return (
    <AdminShell
      title="Owner Console"
      description={`Signed in as ${admin.displayName}`}
      actions={
        <Link href="/admin/services" className="button-primary">
          Manage Services
        </Link>
      }
    >
      <div className="admin-summary-grid">
        <div>
          <span>Active incidents</span>
          <strong>{openIncidents.length}</strong>
        </div>
        <div>
          <span>Failed notifications</span>
          <strong>{failedNotifications.length}</strong>
        </div>
        <div>
          <span>Recently resolved</span>
          <strong>{recentResolved.length}</strong>
        </div>
      </div>

      {/* Open Incidents */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">Active Incidents</h2>
        {openIncidents.length === 0 ? (
          <p className="admin-empty-state">No active incidents</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>State</th>
                  <th>Opened</th>
                  <th>Report Count</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {openIncidents.map((incident) => (
                  <tr key={incident.id}>
                    <td>{incident.service.name}</td>
                    <td>
                      <span
                        className={`status-badge ${
                          incident.state === "OPEN" ? "badge-red" : "badge-amber"
                        }`}
                      >
                        {incident.state}
                      </span>
                    </td>
                    <td>{new Date(incident.openedAt).toLocaleString()}</td>
                    <td>{incident.reportCountAtOpening}</td>
                    <td>
                      <Link
                        href={`/admin/incidents/${incident.id}`}
                        className="text-teal-600 hover:text-teal-700 font-medium"
                      >
                        Manage →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Failed Notifications */}
      {failedNotifications.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Failed Notifications</h2>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Recipient</th>
                  <th>Attempts</th>
                  <th>Last Error</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {failedNotifications.map((job) => (
                  <tr key={job.id}>
                    <td>{job.incident.service.name}</td>
                    <td>{job.recipientEmail}</td>
                    <td>{job.attempts}</td>
                    <td className="max-w-xs truncate">{job.lastError}</td>
                    <td>
                      <form
                        action={async () => {
                          "use server";
                          const { retryNotification } = await import("./actions");
                          await retryNotification({ jobId: job.id });
                        }}
                      >
                        <button
                          type="submit"
                          className="text-teal-600 hover:text-teal-700 font-medium"
                        >
                          Retry
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Recent Resolved */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Recent Resolved</h2>
        {recentResolved.length === 0 ? (
          <p className="admin-empty-state">No resolved incidents</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Opened</th>
                  <th>Resolved</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {recentResolved.map((incident) => (
                  <tr key={incident.id}>
                    <td>{incident.service.name}</td>
                    <td>{new Date(incident.openedAt).toLocaleString()}</td>
                    <td>
                      {incident.resolvedAt
                        ? new Date(incident.resolvedAt).toLocaleString()
                        : "-"}
                    </td>
                    <td>
                      <Link
                        href={`/admin/incidents/${incident.id}`}
                        className="text-teal-600 hover:text-teal-700 font-medium"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AdminShell>
  );
}
