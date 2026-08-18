import { PrismaClient, Prisma } from "@prisma/client";
import { ReportInput, ReportInputSchema } from "./report-schema";
import { hashReporterToken, isValidReporterToken } from "./reporter-token";
import { evaluateService } from "../incidents/incident-detector";
import { getServiceState } from "../incidents/incident-detector";

export class DuplicateReportError extends Error {
  constructor(public nextAllowedAt: Date) {
    super("Duplicate report within cooldown period");
    this.name = "DuplicateReportError";
  }
}

export class InvalidServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidServiceError";
  }
}

export interface ReportReceipt {
  reportId: string;
  acceptedAt: Date;
  nextAllowedAt: Date;
  serviceState: string;
}

/**
 * Submits a report transactionally:
 * 1. Validates input with Zod
 * 2. Validates reporter token
 * 3. Checks service exists and issue type is supported
 * 4. Locks or upserts ReporterCooldown
 * 5. Enforces cooldown period
 * 6. Creates report
 * 7. Updates cooldown
 * 8. Triggers incident detection
 * 9. Returns receipt with service state
 */
export async function submitReport(
  input: ReportInput,
  reporterToken: string,
  hmacSecret: string,
  prismaClient?: PrismaClient
): Promise<ReportReceipt> {
  const prisma = prismaClient || (await import("@/lib/db")).prisma;

  // Validate input
  const validated = ReportInputSchema.parse(input);

  // Validate reporter token
  if (!isValidReporterToken(reporterToken)) {
    throw new Error("Invalid reporter token");
  }

  // Hash the token
  const tokenHmac = hashReporterToken(reporterToken, hmacSecret);

  // Execute in transaction
  const result = await prisma.$transaction(
    async (tx) => {
      // Fetch and validate service
      const service = await tx.service.findUnique({
        where: { id: validated.serviceId },
      });

      if (!service || !service.enabled) {
        throw new InvalidServiceError("Service not found or disabled");
      }

      if (!service.issueTypes.includes(validated.issueType)) {
        throw new InvalidServiceError("Issue type not supported for this service");
      }

      const now = new Date();
      const cooldownWindowMs = service.thresholdWindowMinutes * 60 * 1000;
      const nextAllowedAt = new Date(now.getTime() + cooldownWindowMs);

      // Acquire transaction-scoped advisory lock to serialize concurrent submissions
      // from the same reporter+service, even when cooldown row doesn't exist yet
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtextextended(${validated.serviceId}::text || ':' || ${tokenHmac}, 0))
      `;

      // Check existing cooldown (now serialized by advisory lock)
      const existingCooldown = await tx.reporterCooldown.findUnique({
        where: {
          serviceId_reporterTokenHmac: {
            serviceId: validated.serviceId,
            reporterTokenHmac: tokenHmac,
          },
        },
      });

      // Check if still in cooldown period
      if (existingCooldown) {
        const timeSinceLastReport =
          now.getTime() - existingCooldown.lastReportedAt.getTime();
        if (timeSinceLastReport < cooldownWindowMs) {
          const nextAllowed = new Date(
            existingCooldown.lastReportedAt.getTime() + cooldownWindowMs
          );
          throw new DuplicateReportError(nextAllowed);
        }
      }

      // Create report
      const report = await tx.report.create({
        data: {
          serviceId: validated.serviceId,
          issueType: validated.issueType,
          reporterTokenHmac: tokenHmac,
          note: validated.note,
          reportedAt: now,
        },
      });

      // Update cooldown (create or update)
      await tx.reporterCooldown.upsert({
        where: {
          serviceId_reporterTokenHmac: {
            serviceId: validated.serviceId,
            reporterTokenHmac: tokenHmac,
          },
        },
        create: {
          serviceId: validated.serviceId,
          reporterTokenHmac: tokenHmac,
          lastReportedAt: now,
        },
        update: {
          lastReportedAt: now,
        },
      });

      // Evaluate service for incident detection
      await evaluateService(validated.serviceId, tx);

      // Get current service state
      const serviceState = await getServiceState(validated.serviceId, tx);

      return {
        reportId: report.id,
        acceptedAt: report.reportedAt,
        nextAllowedAt,
        serviceState: serviceState.state,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    }
  );

  return result;
}
