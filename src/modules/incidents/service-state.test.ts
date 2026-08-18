import { describe, expect, it } from "vitest";
import { deriveServiceState } from "./service-state";

describe("deriveServiceState", () => {
  it.each([
    [4, 10, false, true, "OPERATIONAL"],
    [5, 10, false, true, "REPORTS_RISING"],
    [10, 10, true, false, "INCIDENT_CONFIRMED"],
    [10, 10, false, false, "REPORTS_RISING"],
  ] as const)(
    "maps report state (count=%i, threshold=%i, incident=%s, armed=%s) -> %s",
    (count, threshold, hasOpenIncident, armed, expected) => {
      expect(
        deriveServiceState({ count, threshold, hasOpenIncident, armed })
      ).toBe(expected);
    }
  );
});
