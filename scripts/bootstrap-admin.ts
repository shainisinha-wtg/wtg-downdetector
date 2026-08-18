#!/usr/bin/env tsx

import { prisma } from "../src/lib/db";
import { hashPassword } from "../src/modules/auth/password";

async function main() {
  const username = process.env.BOOTSTRAP_ADMIN_USERNAME;
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

  if (!username || !password) {
    console.error("Error: BOOTSTRAP_ADMIN_USERNAME and BOOTSTRAP_ADMIN_PASSWORD are required");
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("Error: Password must be at least 8 characters");
    process.exit(1);
  }

  console.log(`Upserting admin account: ${username}`);

  const passwordHash = await hashPassword(password);

  await prisma.adminAccount.upsert({
    where: { username },
    update: {
      passwordHash,
      displayName: username,
      enabled: true,
    },
    create: {
      username,
      passwordHash,
      displayName: username,
      enabled: true,
    },
  });

  console.log(`✓ Admin account ready: ${username}`);
}

main()
  .catch((error) => {
    console.error("Bootstrap failed:", error.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
