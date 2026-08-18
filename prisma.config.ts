import { defineConfig } from "prisma/config";

// Prisma config files skip the automatic .env loading the deprecated
// package.json#prisma field used to provide, so load it explicitly.
try {
  process.loadEnvFile(".env");
} catch {
  // .env is optional (e.g. CI/docker inject env vars directly)
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
