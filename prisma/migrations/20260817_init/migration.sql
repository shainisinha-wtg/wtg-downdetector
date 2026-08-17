-- CreateEnum
CREATE TYPE "IssueType" AS ENUM ('UNAVAILABLE', 'SLOW', 'LOGIN', 'CONNECTIVITY', 'OTHER');

-- CreateEnum
CREATE TYPE "IncidentState" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "NotificationState" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "IncidentUpdateType" AS ENUM ('OPENED', 'ACKNOWLEDGED', 'RESOLVED', 'REOPENED', 'NOTE');

-- CreateTable
CREATE TABLE "Service" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "ownerEmail" TEXT NOT NULL,
    "thresholdCount" INTEGER NOT NULL,
    "thresholdWindowMinutes" INTEGER NOT NULL,
    "issueTypes" "IssueType"[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" UUID NOT NULL,
    "serviceId" UUID NOT NULL,
    "issueType" "IssueType" NOT NULL,
    "reporterTokenHmac" TEXT NOT NULL,
    "note" TEXT,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReporterCooldown" (
    "id" UUID NOT NULL,
    "serviceId" UUID NOT NULL,
    "reporterTokenHmac" TEXT NOT NULL,
    "lastReportedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReporterCooldown_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" UUID NOT NULL,
    "serviceId" UUID NOT NULL,
    "state" "IncidentState" NOT NULL DEFAULT 'OPEN',
    "thresholdCountSnapshot" INTEGER NOT NULL,
    "thresholdWindowSnapshot" INTEGER NOT NULL,
    "reportCountAtOpening" INTEGER NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentUpdate" (
    "id" UUID NOT NULL,
    "incidentId" UUID NOT NULL,
    "updateType" "IncidentUpdateType" NOT NULL,
    "authorType" TEXT NOT NULL,
    "authorId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationJob" (
    "id" UUID NOT NULL,
    "incidentId" UUID NOT NULL,
    "notificationType" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "state" "NotificationState" NOT NULL DEFAULT 'PENDING',
    "nextAttempt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAccount" (
    "id" UUID NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminSession" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" UUID NOT NULL,
    "accountId" UUID,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Service_slug_key" ON "Service"("slug");

-- CreateIndex
CREATE INDEX "Report_serviceId_reportedAt_idx" ON "Report"("serviceId", "reportedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReporterCooldown_serviceId_reporterTokenHmac_key" ON "ReporterCooldown"("serviceId", "reporterTokenHmac");

-- CreateIndex
CREATE INDEX "Incident_serviceId_state_idx" ON "Incident"("serviceId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "Incident_one_open_per_service" ON "Incident"("serviceId") WHERE "state" = 'OPEN';

-- CreateIndex
CREATE INDEX "IncidentUpdate_incidentId_createdAt_idx" ON "IncidentUpdate"("incidentId", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationJob_state_nextAttempt_idx" ON "NotificationJob"("state", "nextAttempt");

-- CreateIndex
CREATE UNIQUE INDEX "AdminAccount_username_key" ON "AdminAccount"("username");

-- CreateIndex
CREATE INDEX "AdminSession_accountId_expiresAt_idx" ON "AdminSession"("accountId", "expiresAt");

-- CreateIndex
CREATE INDEX "AdminSession_tokenHash_idx" ON "AdminSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AuditEvent_accountId_occurredAt_idx" ON "AuditEvent"("accountId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditEvent_entityType_entityId_idx" ON "AuditEvent"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReporterCooldown" ADD CONSTRAINT "ReporterCooldown_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentUpdate" ADD CONSTRAINT "IncidentUpdate_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationJob" ADD CONSTRAINT "NotificationJob_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminSession" ADD CONSTRAINT "AdminSession_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "AdminAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "AdminAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
