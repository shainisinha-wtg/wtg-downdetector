import { pathToFileURL } from "node:url";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  claimDueJobs,
  deliverJob,
} from "@/modules/notifications/job-repository";
import {
  createSmtpSender,
  SendEmail,
} from "@/modules/notifications/smtp-gateway";

const workerEnvironmentSchema = z.object({
  APP_BASE_URL: z.string().url(),
  WORKER_BATCH_SIZE: z.coerce.number().int().min(1).max(100).default(10),
  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().min(100).default(5_000),
});

interface WorkerOptions {
  batchSize: number;
  pollIntervalMs: number;
  sendEmail: SendEmail;
  shouldStop: () => boolean;
  waitForStop: (milliseconds: number) => Promise<void>;
}

export async function runWorker(options: WorkerOptions): Promise<void> {
  const activeDeliveries = new Set<Promise<void>>();

  while (!options.shouldStop()) {
    const jobs = await claimDueJobs(options.batchSize);

    for (const job of jobs) {
      const delivery = deliverJob(job.id, options.sendEmail)
        .then(() => {
          logOutcome(job, "sent");
        })
        .catch(() => {
          logOutcome(job, "failed");
        })
        .finally(() => {
          activeDeliveries.delete(delivery);
        });
      activeDeliveries.add(delivery);
    }

    if (activeDeliveries.size > 0) {
      await Promise.allSettled(activeDeliveries);
    }
    if (!options.shouldStop() && jobs.length < options.batchSize) {
      await options.waitForStop(options.pollIntervalMs);
    }
  }

  await Promise.allSettled(activeDeliveries);
}

function logOutcome(
  job: {
    id: string;
    incidentId: string;
    recipientEmail: string;
    attempts: number;
  },
  outcome: "sent" | "failed",
) {
  console.info(
    JSON.stringify({
      jobId: job.id,
      incidentId: job.incidentId,
      recipientDomain: job.recipientEmail.split("@").at(-1) ?? "invalid",
      attempt: job.attempts + 1,
      outcome,
    }),
  );
}

async function main() {
  const config = workerEnvironmentSchema.parse(process.env);
  const sendEmail = createSmtpSender();
  let stopping = false;
  let stopPolling: (() => void) | undefined;

  const requestStop = () => {
    stopping = true;
    stopPolling?.();
  };
  process.once("SIGTERM", requestStop);
  process.once("SIGINT", requestStop);

  try {
    await runWorker({
      batchSize: config.WORKER_BATCH_SIZE,
      pollIntervalMs: config.WORKER_POLL_INTERVAL_MS,
      sendEmail,
      shouldStop: () => stopping,
      waitForStop: (milliseconds) =>
        new Promise((resolve) => {
          const timeout = setTimeout(resolve, milliseconds);
          stopPolling = () => {
            clearTimeout(timeout);
            resolve();
          };
        }),
    });
  } finally {
    await prisma.$disconnect();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch(() => {
    console.error("Notification worker stopped because of a fatal error");
    process.exitCode = 1;
  });
}
