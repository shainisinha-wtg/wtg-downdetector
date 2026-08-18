import { requireAdmin } from "@/modules/auth/require-admin";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";

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
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-2xl font-semibold text-neutral-900">
            Owner Console
          </h1>
          <div className="flex items-center gap-4">
            <div className="text-sm text-neutral-600">
              Signed in as {admin.displayName}
            </div>
            <LogoutButton />
          </div>
        </div>

        <div className="mb-6">
          <Link
            href="/admin/services"
            className="text-teal-600 hover:text-teal-700 text-sm font-medium"
          >
            Manage Services →
          </Link>
        </div>

        {/* Open Incidents */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-neutral-900 mb-3">
            Active Incidents
          </h2>
          {openIncidents.length === 0 ? (
            <p className="text-sm text-neutral-600 bg-white p-4 rounded-lg">
              No active incidents
            </p>
          ) : (
            <div className="bg-white rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-neutral-100 border-b border-neutral-200">
                  <tr>
                    <th className="text-left text-xs font-medium text-neutral-700 px-4 py-2">
                      Service
                    </th>
                    <th className="text-left text-xs font-medium text-neutral-700 px-4 py-2">
                      State
                    </th>
                    <th className="text-left text-xs font-medium text-neutral-700 px-4 py-2">
                      Opened
                    </th>
                    <th className="text-left text-xs font-medium text-neutral-700 px-4 py-2">
                      Report Count
                    </th>
                    <th className="text-right text-xs font-medium text-neutral-700 px-4 py-2">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {openIncidents.map((incident) => (
                    <tr key={incident.id} className="hover:bg-neutral-50">
                      <td className="px-4 py-3 text-sm text-neutral-900">
                        {incident.service.name}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                            incident.state === "OPEN"
                              ? "bg-red-100 text-red-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {incident.state}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-600">
                        {new Date(incident.openedAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-900">
                        {incident.reportCountAtOpening}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
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
            <h2 className="text-lg font-semibold text-neutral-900 mb-3">
              Failed Notifications
            </h2>
            <div className="bg-white rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-neutral-100 border-b border-neutral-200">
                  <tr>
                    <th className="text-left text-xs font-medium text-neutral-700 px-4 py-2">
                      Service
                    </th>
                    <th className="text-left text-xs font-medium text-neutral-700 px-4 py-2">
                      Recipient
                    </th>
                    <th className="text-left text-xs font-medium text-neutral-700 px-4 py-2">
                      Attempts
                    </th>
                    <th className="text-left text-xs font-medium text-neutral-700 px-4 py-2">
                      Last Error
                    </th>
                    <th className="text-right text-xs font-medium text-neutral-700 px-4 py-2">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {failedNotifications.map((job) => (
                    <tr key={job.id} className="hover:bg-neutral-50">
                      <td className="px-4 py-3 text-sm text-neutral-900">
                        {job.incident.service.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-600">
                        {job.recipientEmail}
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-600">
                        {job.attempts}
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-600 max-w-xs truncate">
                        {job.lastError}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        <form action={async () => {
                          "use server";
                          const { retryNotification } = await import("./actions");
                          await retryNotification({ jobId: job.id });
                        }}>
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
          <h2 className="text-lg font-semibold text-neutral-900 mb-3">
            Recent Resolved
          </h2>
          {recentResolved.length === 0 ? (
            <p className="text-sm text-neutral-600 bg-white p-4 rounded-lg">
              No resolved incidents
            </p>
          ) : (
            <div className="bg-white rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-neutral-100 border-b border-neutral-200">
                  <tr>
                    <th className="text-left text-xs font-medium text-neutral-700 px-4 py-2">
                      Service
                    </th>
                    <th className="text-left text-xs font-medium text-neutral-700 px-4 py-2">
                      Opened
                    </th>
                    <th className="text-left text-xs font-medium text-neutral-700 px-4 py-2">
                      Resolved
                    </th>
                    <th className="text-right text-xs font-medium text-neutral-700 px-4 py-2">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {recentResolved.map((incident) => (
                    <tr key={incident.id} className="hover:bg-neutral-50">
                      <td className="px-4 py-3 text-sm text-neutral-900">
                        {incident.service.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-600">
                        {new Date(incident.openedAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-600">
                        {incident.resolvedAt
                          ? new Date(incident.resolvedAt).toLocaleString()
                          : "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
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
      </div>
    </div>
  );
}
