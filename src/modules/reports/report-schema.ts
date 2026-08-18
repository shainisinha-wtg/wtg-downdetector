import { z } from "zod";

export const IssueTypeSchema = z.enum([
  "UNAVAILABLE",
  "SLOW",
  "LOGIN",
  "CONNECTIVITY",
  "OTHER",
]);

export const ReportInputSchema = z.object({
  serviceId: z.string().uuid(),
  issueType: IssueTypeSchema,
  note: z.string().max(500).optional(),
});

export type ReportInput = z.infer<typeof ReportInputSchema>;
