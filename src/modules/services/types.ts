import { IssueType } from "@prisma/client";

export interface ServiceSummary {
  id: string;
  name: string;
  slug: string;
  category: string;
  thresholdCount: number;
  thresholdWindowMinutes: number;
}

export interface ServiceDetails extends ServiceSummary {
  ownerEmail: string;
  issueTypes: IssueType[];
  enabled: boolean;
}
