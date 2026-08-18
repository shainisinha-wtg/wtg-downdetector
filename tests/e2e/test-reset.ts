import { expect, request } from "@playwright/test";

export async function resetE2EState(mode: "employee" | "owner") {
  const secret = process.env.E2E_RESET_SECRET;
  if (!secret) throw new Error("E2E_RESET_SECRET is required");

  const api = await request.newContext({ baseURL: "http://localhost:3000" });
  const response = await api.post("/api/test/reset", {
    headers: { authorization: `Bearer ${secret}` },
    data: { mode },
  });

  expect(response.ok(), await response.text()).toBe(true);
  await api.dispose();
}
