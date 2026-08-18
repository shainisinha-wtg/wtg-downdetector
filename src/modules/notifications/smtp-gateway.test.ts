import { describe, expect, it, vi } from "vitest";

const { createTransport } = vi.hoisted(() => ({
  createTransport: vi.fn(() => ({ sendMail: vi.fn() })),
}));

vi.mock("nodemailer", () => ({
  default: { createTransport },
}));

import { createSmtpSender } from "./smtp-gateway";

describe("createSmtpSender", () => {
  it("requires TLS and bounds SMTP operations below the job lease", () => {
    createSmtpSender({
      NODE_ENV: "test",
      SMTP_HOST: "smtp.internal",
      SMTP_PORT: "587",
      SMTP_FROM: "status@example.internal",
    });

    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        requireTLS: true,
        connectionTimeout: 30_000,
        greetingTimeout: 30_000,
        socketTimeout: 120_000,
        tls: expect.objectContaining({ minVersion: "TLSv1.2" }),
      }),
    );
  });
});
