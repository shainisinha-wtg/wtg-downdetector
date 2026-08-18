import { defineConfig } from "vitest/config";
import path from "node:path";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error(
    "TEST_DATABASE_URL must point to a dedicated test database before running integration tests"
  );
}

process.env.DATABASE_URL = testDatabaseUrl;
process.env.DIRECT_URL = testDatabaseUrl;

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.integration.test.ts"],
    maxWorkers: 1,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
