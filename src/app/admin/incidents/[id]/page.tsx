import { requireAdmin } from "@/modules/auth/require-admin";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  acknowledgeIncidentAction,
  publishIncidentUpdateAction,
  resolveIncidentAction,
} from "../../actions";

export default async function IncidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-6">
          <Link
            href="/admin"
            className="text-teal-600 hover:text-teal-700 text-sm font-medium"
          >
            ← Back to Dashboard
          </Link>
        </div>

        <div className="bg-white rounded-lg p-6 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-2xl font-semibold text-neutral-900">
                {incident.service.name}
              </h1>
              <p className="text-sm text-neutral-600 mt-1">
                Opened {new Date(incident.openedAt).toLocaleString()}
              </p>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                incident.state === "OPEN"
                  ? "bg-red-100 text-red-700"
                  : incident.state === "ACKNOWLEDGED"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-green-100 text-green-700"
              }`}
            >
              {incident.state}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-neutral-600">Report Count:</span>{" "}
              <span className="text-neutral-900 font-medium">
                {incident.reportCountAtOpening}
              </span>
            </div>
            <div>
              <span className="text-neutral-600">Threshold:</span>{" "}
              <span className="text-neutral-900 font-medium">
                {incident.thresholdCountSnapshot} reports in{" "}
                {incident.thresholdWindowSnapshot} min
              </span>
            </div>
            {incident.acknowledgedAt && (
              <div>
                <span className="text-neutral-600">Acknowledged:</span>{" "}
                <span className="text-neutral-900">
                  {new Date(incident.acknowledgedAt).toLocaleString()}
                </span>
              </div>
            )}
            {incident.resolvedAt && (
              <div>
                <span className="text-neutral-600">Resolved:</span>{" "}
                <span className="text-neutral-900">
                  {new Date(incident.resolvedAt).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        {isActive && (
          <div className="bg-white rounded-lg p-6 mb-6">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">
              Actions
            </h2>

            <div className="space-y-4">
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
                    className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 text-sm font-medium"
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
                className="space-y-2"
              >
                <label className="block text-sm font-medium text-neutral-700">
                  Publish Update
                </label>
                <textarea
                  name="note"
                  rows={3}
                  maxLength={1000}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                  placeholder="Status update for employees..."
                  required
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 text-sm font-medium"
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
                className="space-y-2"
              >
                <label className="block text-sm font-medium text-neutral-700">
                  Resolve Incident
                </label>
                <textarea
                  name="finalMessage"
                  rows={3}
                  maxLength={1000}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                  placeholder="Final resolution message..."
                  required
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm font-medium"
                >
                  Resolve Incident
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Updates */}
        <div className="bg-white rounded-lg p-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">
            Timeline
          </h2>

          {incident.updates.length === 0 ? (
            <p className="text-sm text-neutral-600">No updates yet</p>
          ) : (
            <div className="space-y-4">
              {incident.updates.map((update) => (
                <div key={update.id} className="border-l-2 border-neutral-200 pl-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        update.updateType === "OPENED"
                          ? "bg-red-100 text-red-700"
                          : update.updateType === "ACKNOWLEDGED"
                          ? "bg-amber-100 text-amber-700"
                          : update.updateType === "RESOLVED"
                          ? "bg-green-100 text-green-700"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {update.updateType}
                    </span>
                    <span className="text-xs text-neutral-600">
                      {new Date(update.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {update.note && (
                    <p className="text-sm text-neutral-900 mt-2">
                      {update.note}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
