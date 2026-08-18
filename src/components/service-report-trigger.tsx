"use client";

import { useState } from "react";
import { ReportDialog } from "@/components/report-dialog";

interface ServiceReportTriggerProps {
  serviceId: string;
  serviceName: string;
  issueTypes: string[];
}

export function ServiceReportTrigger({
  serviceId,
  serviceName,
  issueTypes,
}: ServiceReportTriggerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const services = [{ id: serviceId, name: serviceName, issueTypes }];

  return (
    <>
      <button
        className="report-button"
        onClick={() => setIsDialogOpen(true)}
        aria-label={`Report a problem with ${serviceName}`}
      >
        Report a problem
      </button>
      <ReportDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        services={services}
        preselectedServiceId={serviceId}
      />
    </>
  );
}
