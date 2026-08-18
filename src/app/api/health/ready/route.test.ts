import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryRaw } = vi.hoisted(() => ({ queryRaw: vi.fn() }));

vi.mock("@/lib/db", () => ({
  prisma: { $queryRaw: queryRaw },
}));

import { GET } from "./route";

describe("GET /api/health/ready", () => {
  beforeEach(() => {
    queryRaw.mockReset();
  });

  it("returns 200 when PostgreSQL responds", async () => {
    queryRaw.mockResolvedValue([{ result: 1 }]);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ready" });
  });

  it("returns 503 without exposing database errors", async () => {
    queryRaw.mockRejectedValue(new Error("secret connection details"));

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ status: "unavailable" });
  });
});
