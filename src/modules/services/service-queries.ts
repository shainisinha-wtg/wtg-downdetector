import { PrismaClient, IncidentState, IssueType } from "@prisma/client";
import { getServiceState } from "../incidents/incident-detector";

export interface HourlyReportBucket {
  hour: string; // ISO timestamp for start of hour
  count: number;
}

export interface IssueBreakdown {
  issueType: IssueType;
  count: number;
}

export interface IncidentSummary {
  id: string;
  state: IncidentState;
  openedAt: Date;
  acknowledgedAt: Date | null;
  resolvedAt: Date | null;
  reportCount: number;
  latestUpdate: string | null;
  latestUpdateAt: Date | null;
}

export interface ServiceListItem {
  id: string;
  name: string;
  slug: string;
  category: string;
  issueTypes: IssueType[];
  currentState: string;
  reportCount: number;
  threshold: number;
  hourlyBuckets: HourlyReportBucket[];
  latestOwnerUpdate: string | null;
  latestOwnerUpdateAt: Date | null;
}

export interface ServiceDetailData {
  id: string;
  name: string;
  slug: string;
  category: string;
  issueTypes: IssueType[];
  currentState: string;
  reportCount: number;
  threshold: number;
  hourlyBuckets: HourlyReportBucket[];
  issueBreakdown: IssueBreakdown[];
  latestOwnerUpdate: string | null;
  latestOwnerUpdateAt: Date | null;
  activeIncident: IncidentSummary | null;
  recentResolvedIncidents: IncidentSummary[];
}

/**
 * Get 24 hourly report buckets for a service using SQL aggregation.
 * Each bucket contains the count of distinct reporters in that hour.
 */
async function getHourlyBuckets(
  serviceId: string,
  prisma: PrismaClient,
): Promise<HourlyReportBucket[]> {
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Generate 24 hourly buckets
  const buckets: HourlyReportBucket[] = [];
  for (let i = 0; i < 24; i++) {
    const hourStart = new Date(
      twentyFourHoursAgo.getTime() + i * 60 * 60 * 1000,
    );
    buckets.push({
      hour: hourStart.toISOString(),
      count: 0,
    });
  }

  // Use SQL aggregation to count distinct reporters per hour
  const hourlyData = await prisma.$queryRaw<
    Array<{ hour: Date; count: bigint }>
  >`
    SELECT
      DATE_TRUNC('hour', "reportedAt") as hour,
      COUNT(DISTINCT "reporterTokenHmac") as count
    FROM "Report"
    WHERE "serviceId" = ${serviceId}::uuid
      AND "reportedAt" >= ${twentyFourHoursAgo}
    GROUP BY DATE_TRUNC('hour', "reportedAt")
    ORDER BY hour
  `;

  // Map aggregated data to buckets
  const hourlyMap = new Map(
    hourlyData.map((row) => [
      new Date(row.hour).toISOString().slice(0, 13), // Truncate to hour precision
      Number(row.count),
    ]),
  );

  // Fill in the counts for each bucket
  for (const bucket of buckets) {
    const hourKey = bucket.hour.slice(0, 13);
    bucket.count = hourlyMap.get(hourKey) || 0;
  }

  return buckets;
}

/**
 * Get issue breakdown for the active detection window.
 */
async function getIssueBreakdown(
  serviceId: string,
  windowMinutes: number,
  prisma: PrismaClient,
): Promise<IssueBreakdown[]> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowMinutes * 60 * 1000);

  const result = await prisma.$queryRaw<
    Array<{ issueType: IssueType; count: bigint }>
  >`
    SELECT "issueType", COUNT(DISTINCT "reporterTokenHmac") as count
    FROM "Report"
    WHERE "serviceId" = ${serviceId}::uuid
      AND "reportedAt" >= ${windowStart}
    GROUP BY "issueType"
    ORDER BY count DESC
  `;

  return result.map((r) => ({
    issueType: r.issueType,
    count: Number(r.count),
  }));
}

/**
 * Get latest owner update from most recent incident.
 */
async function getLatestOwnerUpdate(
  serviceId: string,
  prisma: PrismaClient,
): Promise<{ message: string; updatedAt: Date } | null> {
  const latestUpdate = await prisma.incidentUpdate.findFirst({
    where: {
      incident: {
        serviceId,
      },
      updateType: {
        in: ["ACKNOWLEDGED", "RESOLVED", "NOTE"],
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      note: true,
      createdAt: true,
    },
  });

  if (!latestUpdate || !latestUpdate.note) return null;

  return {
    message: latestUpdate.note,
    updatedAt: latestUpdate.createdAt,
  };
}

/**
 * Get list of all enabled services with current state and sparkline data.
 * Uses concurrent queries via Promise.all for improved performance.
 */
export async function getServiceList(
  prismaClient?: PrismaClient,
): Promise<ServiceListItem[]> {
  const prisma = prismaClient || (await import("@/lib/db")).prisma;

  const services = await prisma.service.findMany({
    where: { enabled: true },
    orderBy: { name: "asc" },
  });

  // Execute all per-service queries concurrently
  const serviceDataPromises = services.map(async (service) => {
    const [stateInfo, hourlyBuckets, latestUpdate] = await Promise.all([
      getServiceState(service.id, prisma),
      getHourlyBuckets(service.id, prisma),
      getLatestOwnerUpdate(service.id, prisma),
    ]);

    return {
      id: service.id,
      name: service.name,
      slug: service.slug,
      category: service.category,
      issueTypes: service.issueTypes,
      currentState: stateInfo.state,
      reportCount: stateInfo.count,
      threshold: service.thresholdCount,
      hourlyBuckets,
      latestOwnerUpdate: latestUpdate?.message || null,
      latestOwnerUpdateAt: latestUpdate?.updatedAt || null,
    };
  });

  return Promise.all(serviceDataPromises);
}

/**
 * Get detailed information for a specific service by slug.
 */
export async function getServiceDetail(
  slug: string,
  prismaClient?: PrismaClient,
): Promise<ServiceDetailData | null> {
  const prisma = prismaClient || (await import("@/lib/db")).prisma;

  const service = await prisma.service.findUnique({
    where: { slug, enabled: true },
  });

  if (!service) return null;

  const stateInfo = await getServiceState(service.id, prisma);
  const hourlyBuckets = await getHourlyBuckets(service.id, prisma);
  const issueBreakdown = await getIssueBreakdown(
    service.id,
    service.thresholdWindowMinutes,
    prisma,
  );
  const latestUpdate = await getLatestOwnerUpdate(service.id, prisma);

  // Get active incident
  const activeIncident = await prisma.incident.findFirst({
    where: {
      serviceId: service.id,
      state: { in: [IncidentState.OPEN, IncidentState.ACKNOWLEDGED] },
    },
    include: {
      updates: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  let activeIncidentSummary: IncidentSummary | null = null;
  if (activeIncident) {
    activeIncidentSummary = {
      id: activeIncident.id,
      state: activeIncident.state,
      openedAt: activeIncident.openedAt,
      acknowledgedAt: activeIncident.acknowledgedAt,
      resolvedAt: activeIncident.resolvedAt,
      reportCount: activeIncident.reportCountAtOpening,
      latestUpdate: activeIncident.updates[0]?.note || null,
      latestUpdateAt: activeIncident.updates[0]?.createdAt || null,
    };
  }

  // Get recent resolved incidents (last 3)
  const resolvedIncidents = await prisma.incident.findMany({
    where: {
      serviceId: service.id,
      state: IncidentState.RESOLVED,
    },
    orderBy: { resolvedAt: "desc" },
    take: 3,
    include: {
      updates: {
        where: { updateType: "RESOLVED" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  const recentResolvedIncidents: IncidentSummary[] = resolvedIncidents.map(
    (incident) => ({
      id: incident.id,
      state: incident.state,
      openedAt: incident.openedAt,
      acknowledgedAt: incident.acknowledgedAt,
      resolvedAt: incident.resolvedAt,
      reportCount: incident.reportCountAtOpening,
      latestUpdate: incident.updates[0]?.note || null,
      latestUpdateAt: incident.updates[0]?.createdAt || null,
    }),
  );

  return {
    id: service.id,
    name: service.name,
    slug: service.slug,
    category: service.category,
    issueTypes: service.issueTypes as IssueType[],
    currentState: stateInfo.state,
    reportCount: stateInfo.count,
    threshold: service.thresholdCount,
    hourlyBuckets,
    issueBreakdown,
    latestOwnerUpdate: latestUpdate?.message || null,
    latestOwnerUpdateAt: latestUpdate?.updatedAt || null,
    activeIncident: activeIncidentSummary,
    recentResolvedIncidents,
  };
}
