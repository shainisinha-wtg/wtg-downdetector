export type ServiceState =
  | "OPERATIONAL"
  | "REPORTS_RISING"
  | "INCIDENT_CONFIRMED";

export interface ServiceStateInput {
  count: number;
  threshold: number;
  hasOpenIncident: boolean;
  armed: boolean;
}

/**
 * Derives service state from report count and incident status.
 *
 * - INCIDENT_CONFIRMED: An open incident exists.
 * - REPORTS_RISING: No open incident, but count is at or above 50% threshold or detection is disarmed.
 * - OPERATIONAL: No open incident, detection armed, and count below 50% threshold.
 */
export function deriveServiceState(input: ServiceStateInput): ServiceState {
  if (input.hasOpenIncident) {
    return "INCIDENT_CONFIRMED";
  }

  const halfThreshold = Math.ceil(input.threshold / 2);
  if (!input.armed || input.count >= halfThreshold) {
    return "REPORTS_RISING";
  }

  return "OPERATIONAL";
}
