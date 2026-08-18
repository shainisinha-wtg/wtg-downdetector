import { describe, expect, it } from "vitest";
import { renderIncidentOpeningEmail } from "./email-template";

describe("renderIncidentOpeningEmail", () => {
  it("renders the incident details in text and HTML", () => {
    const email = renderIncidentOpeningEmail({
      serviceName: "Jira",
      reportCount: 12,
      thresholdWindowMinutes: 10,
      issueBreakdown: [
        { issueType: "UNAVAILABLE", count: 8 },
        { issueType: "SLOW", count: 4 },
      ],
      firstReportAt: new Date("2026-08-18T10:15:00.000Z"),
      adminUrl: "https://status.internal/admin/incidents/incident-1",
    });

    expect(email.subject).toContain("Jira");
    for (const content of [email.text, email.html]) {
      expect(content).toContain("12 reports in 10 minutes");
      expect(content).toContain("UNAVAILABLE: 8");
      expect(content).toContain("SLOW: 4");
      expect(content).toContain("2026-08-18T10:15:00.000Z");
      expect(content).toContain(
        "https://status.internal/admin/incidents/incident-1",
      );
    }
  });

  it("escapes untrusted values in HTML", () => {
    const email = renderIncidentOpeningEmail({
      serviceName: "VPN <script>alert(1)</script>",
      reportCount: 5,
      thresholdWindowMinutes: 10,
      issueBreakdown: [{ issueType: "OTHER", count: 5 }],
      firstReportAt: new Date("2026-08-18T10:15:00.000Z"),
      adminUrl: "https://status.internal/admin?next=<unsafe>",
    });

    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).toContain("next=&lt;unsafe&gt;");
  });
});
