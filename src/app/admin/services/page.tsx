import { requireAdmin } from "@/modules/auth/require-admin";
import { prisma } from "@/lib/db";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { ServiceEditDialog } from "@/components/service-edit-dialog";
import { ServiceCreateDialog } from "@/components/service-create-dialog";
import { MaintenanceScheduleDialog } from "@/components/maintenance-schedule-dialog";
import { MaintenanceCancelButton } from "@/components/maintenance-cancel-button";
import { getUpcomingMaintenanceWindows } from "@/modules/maintenance/maintenance-windows";

export default async function AdminServicesPage() {
  await requireAdmin();

  const [services, maintenanceWindows] = await Promise.all([
    prisma.service.findMany({ orderBy: { name: "asc" } }),
    getUpcomingMaintenanceWindows({ includeDisabledServices: true }),
  ]);

  return (
    <AdminShell
      title="Service Management"
      description="Configure services, thresholds, and owner contacts."
      actions={
        <div className="flex items-center gap-3">
          <ServiceCreateDialog
            action={async (formData) => {
              "use server";
              const { createService } = await import("../actions");
              return createService({
                name: formData.get("name"),
                slug: formData.get("slug"),
                category: formData.get("category"),
                baseUrl: formData.get("baseUrl"),
                ownerEmail: formData.get("ownerEmail"),
                thresholdCount: Number(formData.get("thresholdCount")),
                thresholdWindowMinutes: Number(
                  formData.get("thresholdWindowMinutes"),
                ),
                issueTypes: formData.getAll("issueTypes"),
                enabled: true,
              });
            }}
          />
          <Link href="/admin" className="button-secondary icon-text-button">
            <ArrowLeft size={16} aria-hidden="true" />
            Back to Dashboard
          </Link>
        </div>
      }
    >
      {services.length === 0 ? (
        <p className="admin-empty-state">No services configured.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Service</th>
                <th>Owner Email</th>
                <th>Threshold</th>
                <th>Window</th>
                <th>Detection</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {services.map((service) => (
                <tr key={service.id}>
                  <td>
                    <div>{service.name}</div>
                    <div className="cell-meta">{service.category}</div>
                  </td>
                  <td>{service.ownerEmail}</td>
                  <td>{service.thresholdCount} reports</td>
                  <td>{service.thresholdWindowMinutes} min</td>
                  <td>
                    <span
                      className={`status-badge ${
                        service.detectionArmed ? "badge-green" : "badge-amber"
                      }`}
                    >
                      {service.detectionArmed ? "Armed" : "Disarmed"}
                    </span>
                  </td>
                  <td>
                    <div className="admin-row-actions">
                      <MaintenanceScheduleDialog
                        service={{ id: service.id, name: service.name }}
                        action={async (formData) => {
                          "use server";
                          const { scheduleMaintenanceWindowAction } =
                            await import("../actions");
                          const description = formData.get("description");
                          return scheduleMaintenanceWindowAction({
                            serviceId: formData.get("serviceId"),
                            title: formData.get("title"),
                            description:
                              typeof description === "string" && description.trim()
                                ? description
                                : undefined,
                            startsAt: formData.get("startsAt"),
                            endsAt: formData.get("endsAt"),
                          });
                        }}
                      />
                      <ServiceEditDialog
                        service={service}
                        action={async (formData) => {
                          "use server";
                          const { updateService } = await import("../actions");
                          return updateService({
                            serviceId: service.id,
                            category: formData.get("category"),
                            baseUrl: formData.get("baseUrl"),
                            thresholdCount: Number(formData.get("thresholdCount")),
                            thresholdWindowMinutes: Number(
                              formData.get("thresholdWindowMinutes"),
                            ),
                            ownerEmail: formData.get("ownerEmail"),
                            issueTypes: formData.getAll("issueTypes"),
                            enabled: formData.get("enabled") === "on",
                          });
                        }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section className="admin-section">
        <h2>Maintenance windows</h2>
        <p className="cell-meta">
          Scheduled and in-progress windows are shown to employees on the status
          page.
        </p>

        {maintenanceWindows.length === 0 ? (
          <p className="admin-empty-state">No maintenance windows scheduled.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Summary</th>
                  <th>Starts</th>
                  <th>Ends</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {maintenanceWindows.map((window) => (
                  <tr key={window.id}>
                    <td>{window.serviceName}</td>
                    <td>
                      <div>{window.title}</div>
                      {window.description && (
                        <div className="cell-meta">{window.description}</div>
                      )}
                    </td>
                    <td suppressHydrationWarning>
                      {window.startsAt.toLocaleString()}
                    </td>
                    <td suppressHydrationWarning>
                      {window.endsAt.toLocaleString()}
                    </td>
                    <td>
                      <span
                        className={`status-badge ${
                          window.inProgress ? "badge-amber" : "badge-green"
                        }`}
                      >
                        {window.inProgress ? "In progress" : "Scheduled"}
                      </span>
                    </td>
                    <td>
                      <MaintenanceCancelButton
                        action={async () => {
                          "use server";
                          const { cancelMaintenanceWindowAction } =
                            await import("../actions");
                          return cancelMaintenanceWindowAction({
                            maintenanceWindowId: window.id,
                          });
                        }}
                      />
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
