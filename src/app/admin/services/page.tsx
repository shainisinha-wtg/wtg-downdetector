import { requireAdmin } from "@/modules/auth/require-admin";
import { prisma } from "@/lib/db";
import Link from "next/link";

export default async function AdminServicesPage() {
  await requireAdmin();

  const services = await prisma.service.findMany({
    orderBy: { name: "asc" },
  });

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-2xl font-semibold text-neutral-900">
            Service Management
          </h1>
          <div className="flex items-center gap-4">
            <CreateServiceForm />
            <Link
              href="/admin"
              className="text-teal-600 hover:text-teal-700 text-sm font-medium"
            >
              ← Back to Dashboard
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-neutral-100 border-b border-neutral-200">
              <tr>
                <th className="text-left text-xs font-medium text-neutral-700 px-4 py-2">
                  Service
                </th>
                <th className="text-left text-xs font-medium text-neutral-700 px-4 py-2">
                  Owner Email
                </th>
                <th className="text-left text-xs font-medium text-neutral-700 px-4 py-2">
                  Threshold
                </th>
                <th className="text-left text-xs font-medium text-neutral-700 px-4 py-2">
                  Window
                </th>
                <th className="text-left text-xs font-medium text-neutral-700 px-4 py-2">
                  Detection
                </th>
                <th className="text-right text-xs font-medium text-neutral-700 px-4 py-2">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {services.map((service) => (
                <tr key={service.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3 text-sm">
                    <div className="text-neutral-900 font-medium">
                      {service.name}
                    </div>
                    <div className="text-neutral-600 text-xs">
                      {service.category}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-neutral-900">
                    {service.ownerEmail}
                  </td>
                  <td className="px-4 py-3 text-sm text-neutral-900">
                    {service.thresholdCount} reports
                  </td>
                  <td className="px-4 py-3 text-sm text-neutral-900">
                    {service.thresholdWindowMinutes} min
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                        service.detectionArmed
                          ? "bg-green-100 text-green-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {service.detectionArmed ? "Armed" : "Disarmed"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    <ServiceEditForm service={service} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ServiceEditForm({
  service,
}: {
  service: {
    id: string;
    name: string;
    ownerEmail: string;
    thresholdCount: number;
    thresholdWindowMinutes: number;
    issueTypes: string[];
    category: string;
    enabled: boolean;
  };
}) {
  return (
    <details className="inline">
      <summary className="text-teal-600 hover:text-teal-700 font-medium cursor-pointer">
        Edit
      </summary>
      <form
        action={async (formData: FormData) => {
          "use server";
          const { updateService } = await import("../actions");
          await updateService({
            serviceId: service.id,
            category: formData.get("category"),
            thresholdCount: Number(formData.get("thresholdCount")),
            thresholdWindowMinutes: Number(
              formData.get("thresholdWindowMinutes"),
            ),
            ownerEmail: formData.get("ownerEmail"),
            issueTypes: formData.getAll("issueTypes"),
            enabled: formData.get("enabled") === "on",
          });
        }}
        className="absolute right-0 mt-2 bg-white border border-neutral-200 rounded-lg shadow-lg p-4 z-10 w-96"
      >
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">
              Category
            </label>
            <input
              type="text"
              name="category"
              defaultValue={service.category}
              className="w-full px-2 py-1 text-sm border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-teal-500"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">
              Owner Email
            </label>
            <input
              type="email"
              name="ownerEmail"
              defaultValue={service.ownerEmail}
              className="w-full px-2 py-1 text-sm border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-teal-500"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">
              Threshold Count
            </label>
            <input
              type="number"
              name="thresholdCount"
              defaultValue={service.thresholdCount}
              min="1"
              max="1000"
              className="w-full px-2 py-1 text-sm border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-teal-500"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">
              Window (minutes)
            </label>
            <input
              type="number"
              name="thresholdWindowMinutes"
              defaultValue={service.thresholdWindowMinutes}
              min="1"
              max="1440"
              className="w-full px-2 py-1 text-sm border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-teal-500"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">
              Issue Types
            </label>
            <div className="space-y-1">
              {["UNAVAILABLE", "SLOW", "LOGIN", "CONNECTIVITY", "OTHER"].map(
                (type) => (
                  <label key={type} className="flex items-center text-sm">
                    <input
                      type="checkbox"
                      name="issueTypes"
                      value={type}
                      defaultChecked={service.issueTypes.includes(type)}
                      className="mr-2"
                    />
                    {type}
                  </label>
                ),
              )}
            </div>
          </div>
          <label className="flex items-center text-sm text-neutral-900">
            <input
              type="checkbox"
              name="enabled"
              defaultChecked={service.enabled}
              className="mr-2"
            />
            Enabled
          </label>
          <button
            type="submit"
            className="w-full py-1 px-3 bg-teal-600 text-white text-sm rounded hover:bg-teal-700"
          >
            Save Changes
          </button>
        </div>
      </form>
    </details>
  );
}

function CreateServiceForm() {
  return (
    <details className="relative">
      <summary className="cursor-pointer rounded bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700">
        Add service
      </summary>
      <form
        action={async (formData: FormData) => {
          "use server";
          const { createService } = await import("../actions");
          await createService({
            name: formData.get("name"),
            slug: formData.get("slug"),
            category: formData.get("category"),
            ownerEmail: formData.get("ownerEmail"),
            thresholdCount: Number(formData.get("thresholdCount")),
            thresholdWindowMinutes: Number(
              formData.get("thresholdWindowMinutes"),
            ),
            issueTypes: formData.getAll("issueTypes"),
            enabled: true,
          });
        }}
        className="absolute right-0 z-20 mt-2 w-96 space-y-3 rounded-lg border border-neutral-200 bg-white p-4 text-left shadow-lg"
      >
        {[
          ["name", "Name", "Jira"],
          ["slug", "Slug", "jira"],
          ["category", "Category", "Developer Tools"],
          ["ownerEmail", "Owner email", "jira-owners@example.internal"],
        ].map(([name, label, placeholder]) => (
          <label
            key={name}
            className="block text-xs font-medium text-neutral-700"
          >
            {label}
            <input
              type={name === "ownerEmail" ? "email" : "text"}
              name={name}
              placeholder={placeholder}
              className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500"
              required
            />
          </label>
        ))}
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs font-medium text-neutral-700">
            Threshold
            <input
              type="number"
              name="thresholdCount"
              defaultValue="10"
              min="1"
              max="1000"
              className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 text-sm"
              required
            />
          </label>
          <label className="text-xs font-medium text-neutral-700">
            Window (minutes)
            <input
              type="number"
              name="thresholdWindowMinutes"
              defaultValue="10"
              min="1"
              max="1440"
              className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 text-sm"
              required
            />
          </label>
        </div>
        <fieldset>
          <legend className="mb-1 text-xs font-medium text-neutral-700">
            Issue types
          </legend>
          <div className="grid grid-cols-2 gap-1">
            {["UNAVAILABLE", "SLOW", "LOGIN", "CONNECTIVITY", "OTHER"].map(
              (type) => (
                <label key={type} className="flex items-center text-sm">
                  <input
                    type="checkbox"
                    name="issueTypes"
                    value={type}
                    defaultChecked={type === "UNAVAILABLE"}
                    className="mr-2"
                  />
                  {type}
                </label>
              ),
            )}
          </div>
        </fieldset>
        <button
          type="submit"
          className="w-full rounded bg-teal-600 px-3 py-2 text-sm text-white hover:bg-teal-700"
        >
          Create service
        </button>
      </form>
    </details>
  );
}
