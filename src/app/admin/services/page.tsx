import { requireAdmin } from "@/modules/auth/require-admin";
import { prisma } from "@/lib/db";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { ServiceEditDialog } from "@/components/service-edit-dialog";
import { ServiceCreateDialog } from "@/components/service-create-dialog";

export default async function AdminServicesPage() {
  await requireAdmin();

  const services = await prisma.service.findMany({
    orderBy: { name: "asc" },
  });

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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
