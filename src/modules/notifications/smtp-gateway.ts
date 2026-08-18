import nodemailer from "nodemailer";
import { z } from "zod";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export type SendEmail = (message: EmailMessage) => Promise<void>;

const smtpEnvironmentSchema = z
  .object({
    SMTP_HOST: z.string().min(1),
    SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
    SMTP_USERNAME: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    SMTP_FROM: z.string().email(),
  })
  .refine(
    ({ SMTP_USERNAME, SMTP_PASSWORD }) =>
      Boolean(SMTP_USERNAME) === Boolean(SMTP_PASSWORD),
    "SMTP_USERNAME and SMTP_PASSWORD must be provided together",
  );

export function createSmtpSender(
  environment: NodeJS.ProcessEnv = process.env,
): SendEmail {
  const config = smtpEnvironmentSchema.parse(environment);
  const transport = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: false,
    requireTLS: true,
    connectionTimeout: 30_000,
    greetingTimeout: 30_000,
    socketTimeout: 120_000,
    tls: { minVersion: "TLSv1.2" },
    auth: config.SMTP_USERNAME
      ? { user: config.SMTP_USERNAME, pass: config.SMTP_PASSWORD }
      : undefined,
  });

  return async (message) => {
    await transport.sendMail({ ...message, from: config.SMTP_FROM });
  };
}
