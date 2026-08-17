import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { ServiceRepository } from "./service-repository";

describe("ServiceRepository", () => {
  beforeAll(async () => {
    await prisma.service.createMany({
      data: [
        { name: "Jira", slug: "jira", category: "Developer Tools", ownerEmail: "jira-owners@example.internal", thresholdCount: 10, thresholdWindowMinutes: 10, issueTypes: ["UNAVAILABLE", "SLOW", "LOGIN"], enabled: true },
        { name: "Legacy", slug: "legacy", category: "Business Systems", ownerEmail: "legacy@example.internal", thresholdCount: 5, thresholdWindowMinutes: 10, issueTypes: ["UNAVAILABLE"], enabled: false },
      ],
      skipDuplicates: true,
    });
  });

  it("returns enabled services only", async () => {
    const services = await new ServiceRepository(prisma).listEnabled();
    expect(services.map(({ slug }) => slug)).toContain("jira");
    expect(services.map(({ slug }) => slug)).not.toContain("legacy");
  });
});
