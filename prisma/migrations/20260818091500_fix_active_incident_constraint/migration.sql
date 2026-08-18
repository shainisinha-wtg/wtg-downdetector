-- Drop the old unique index that only applies to OPEN incidents
DROP INDEX "Incident_one_open_per_service";

-- Recreate the unique index to include both OPEN and ACKNOWLEDGED incidents
-- This ensures acknowledged incidents are still treated as active and prevent duplicates
CREATE UNIQUE INDEX "Incident_one_open_per_service" ON "Incident"("serviceId") WHERE "state" IN ('OPEN', 'ACKNOWLEDGED');
