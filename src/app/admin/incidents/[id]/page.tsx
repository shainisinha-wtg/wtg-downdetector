import { requireAdmin } from "@/modules/auth/require-admin";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import {
  acknowledgeIncidentAction,
  publishIncidentUpdateAction,
  resolveIncidentAction,
} from "../../actions";

export default async function IncidentDetailPage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  await requireAdmin();
  const { id } = await params;

  const incident = await prisma.incident.findUnique({
    where: { id },
    include: {
      service: true,
      updates: {
        orderBy: { createdAt: "desc" },
        include: {
          incident: {
            select: {
              service: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!incident) {
    notFound();
  }

  const isActive = incident.state === "OPEN" || incident.state === "ACKNOWLEDGED";

  return (
    <AdminShell
      title={incident.service.name}
      description={`Incident opened ${new Date(incident.openedAt).toLocaleString()}`}
      actions={
        <Link href="/admin" className="button-secondary">
          Back to dashboard
        </Link>
      }
    >
      <div className="incident-detail">
        <section className="incident-overview">
          <div className="incident-overview__header">
            <div>
              <p className="dashboard-kicker">Incident overview</p>
              <h2>{incident.service.name}</h2>
            </div>
            <span
              className={`status-badge ${incidentStateBadgeClass(incident.state)}`}
            >
              {incident.state}
            </span>
          </div>

          <dl className="incident-facts">
            <div>
              <dt>Report count</dt>
              <dd>{incident.reportCountAtOpening}</dd>
            </div>
            <div>
              <dt>Threshold</dt>
              <dd>
                {incident.thresholdCountSnapshot} reports in {incident.thresholdWindowSnapshot} min
              </dd>
            </div>
            {incident.acknowledgedAt && (
              <div>
                <dt>Acknowledged</dt>
                <dd>{new Date(incident.acknowledgedAt).toLocaleString()}</dd>
              </div>
            )}
            {incident.resolvedAt && (
              <div>
                <dt>Resolved</dt>
                <dd>{new Date(incident.resolvedAt).toLocaleString()}</dd>
              </div>
            )}
          </dl>
        </section>

        {/* Actions */}
        {isActive && (
          <section className="incident-actions">
            <h2>Actions</h2>

            <div className="incident-actions__stack">
              {/* Acknowledge */}
              {incident.state === "OPEN" && (
                <form
                  action={async () => {
                    "use server";
                    await acknowledgeIncidentAction({ incidentId: incident.id });
                  }}
                >
                  <button
                    type="submit"
                    className="button-secondary"
                  >
                    Acknowledge Incident
                  </button>
                </form>
              )}

              {/* Publish Update */}
              <form
                action={async (formData: FormData) => {
                  "use server";
                  const note = formData.get("note") as string;
                  await publishIncidentUpdateAction({
                    incidentId: incident.id,
                    note,
                  });
                }}
                className="form-field"
              >
                <label
                  htmlFor="incident-update-note"
                >
                  Publish Update
                </label>
                <textarea
                  id="incident-update-note"
                  name="note"
                  rows={3}
                  maxLength={1000}
                  placeholder="Status update for employees..."
                  required
                />
                <button
                  type="submit"
                  className="button-primary"
                >
                  Publish Update
                </button>
              </form>

              {/* Resolve */}
              <form
                action={async (formData: FormData) => {
                  "use server";
                  const finalMessage = formData.get("finalMessage") as string;
                  await resolveIncidentAction({
                    incidentId: incident.id,
                    finalMessage,
                  });
                }}
                className="form-field"
              >
                <label
                  htmlFor="incident-resolution-message"
                >
                  Resolve Incident
                </label>
                <textarea
                  id="incident-resolution-message"
                  name="finalMessage"
                  rows={3}
                  maxLength={1000}
                  placeholder="Final resolution message..."
                  required
                />
                <button
                  type="submit"
                  className="button-primary"
                >
                  Resolve Incident
                </button>
              </form>
            </div>
          </section>
        )}

        <section className="incident-timeline">
          <h2>Timeline</h2>

          {incident.updates.length === 0 ? (
            <p className="admin-empty-state">No updates yet</p>
          ) : (
            <div className="incident-timeline__list">
              {incident.updates.map((update) => (
                <div key={update.id} className="incident-timeline__item">
                  <div className="incident-timeline__meta">
                    <span
                      className={`status-badge ${updateTypeBadgeClass(update.updateType)}`}
                    >
                      {update.updateType}
                    </span>
                    <span className="incident-timeline__time">
                      {new Date(update.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {update.note && (
                    <p className="incident-timeline__note">
                      {update.note}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AdminShell>
  );
}

function incidentStateBadgeClass(state: string): string {
  if (state === "OPEN") return "badge-red";
  if (state === "ACKNOWLEDGED") return "badge-amber";
  return "badge-green";
}

function updateTypeBadgeClass(updateType: string): string {
  if (updateType === "OPENED") return "badge-red";
  if (updateType === "ACKNOWLEDGED") return "badge-amber";
  if (updateType === "RESOLVED") return "badge-green";
  return "badge-amber";
}
