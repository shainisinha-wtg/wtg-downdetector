export interface IncidentOpeningEmailInput {
  serviceName: string;
  reportCount: number;
  thresholdWindowMinutes: number;
  issueBreakdown: Array<{ issueType: string; count: number }>;
  firstReportAt: Date;
  adminUrl: string;
}

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character] ?? character,
  );
}

export function renderIncidentOpeningEmail(
  input: IncidentOpeningEmailInput,
): RenderedEmail {
  const summary = `${input.reportCount} reports in ${input.thresholdWindowMinutes} minutes`;
  const firstReportAt = input.firstReportAt.toISOString();
  const issueLines = input.issueBreakdown.map(
    ({ issueType, count }) => `${issueType}: ${count}`,
  );

  return {
    subject: `[Service incident] ${input.serviceName}: ${summary}`,
    text: [
      `A service incident has opened for ${input.serviceName}.`,
      summary,
      `First report: ${firstReportAt}`,
      "Issue breakdown:",
      ...issueLines,
      `Manage incident: ${input.adminUrl}`,
    ].join("\n"),
    html: [
      `<p>A service incident has opened for <strong>${escapeHtml(input.serviceName)}</strong>.</p>`,
      `<p>${summary}</p>`,
      `<p>First report: ${firstReportAt}</p>`,
      `<p>Issue breakdown:</p><ul>${input.issueBreakdown
        .map(
          ({ issueType, count }) =>
            `<li>${escapeHtml(issueType)}: ${count}</li>`,
        )
        .join("")}</ul>`,
      `<p><a href="${escapeHtml(input.adminUrl)}">Manage incident</a>: ${escapeHtml(input.adminUrl)}</p>`,
    ].join(""),
  };
}
