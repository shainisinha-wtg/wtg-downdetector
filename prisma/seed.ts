import { PrismaClient, IssueType } from "@prisma/client";
import { hashPassword } from "../src/modules/auth/password";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  const passwordHash = await hashPassword("admin");

  await prisma.adminAccount.upsert({
    where: { username: "admin" },
    update: {
      passwordHash,
      displayName: "Admin",
      enabled: true,
    },
    create: {
      username: "admin",
      passwordHash,
      displayName: "Admin",
      enabled: true,
    },
  });

  // Seed services with idempotent upsert by slug
  await prisma.service.upsert({
    where: { slug: "jira" },
    update: {},
    create: {
      name: "Jira",
      slug: "jira",
      category: "Developer Tools",
      ownerEmail: "jira-owners@example.internal",
      thresholdCount: 10,
      thresholdWindowMinutes: 10,
      issueTypes: [IssueType.UNAVAILABLE, IssueType.SLOW, IssueType.LOGIN],
      enabled: true,
    },
  });

  await prisma.service.upsert({
    where: { slug: "bitbucket" },
    update: {},
    create: {
      name: "Bitbucket",
      slug: "bitbucket",
      category: "Developer Tools",
      ownerEmail: "bitbucket-owners@example.internal",
      thresholdCount: 10,
      thresholdWindowMinutes: 10,
      issueTypes: [IssueType.UNAVAILABLE, IssueType.SLOW, IssueType.LOGIN],
      enabled: true,
    },
  });

  await prisma.service.upsert({
    where: { slug: "vpn" },
    update: {},
    create: {
      name: "VPN",
      slug: "vpn",
      category: "Connectivity",
      ownerEmail: "vpn-owners@example.internal",
      thresholdCount: 15,
      thresholdWindowMinutes: 10,
      issueTypes: [IssueType.UNAVAILABLE, IssueType.CONNECTIVITY, IssueType.SLOW],
      enabled: true,
    },
  });

  console.log("Seeding complete.");
}

main()
  .catch((e) => {
    console.error("Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
