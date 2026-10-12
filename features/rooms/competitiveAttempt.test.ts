import { describe, expect, it } from "vitest";
import { getCompetitiveAttemptStatus } from "@/lib/rooms/competitiveAttemptStatus";

describe("competitive attempt status", () => {
  it("maps the lifecycle to the visible room states", () => {
    expect(getCompetitiveAttemptStatus([])).toBe("available");
    expect(getCompetitiveAttemptStatus([{ status: "in_progress" }])).toBe("inProgress");
    expect(getCompetitiveAttemptStatus([{ status: "completed" }])).toBe("completed");
    expect(getCompetitiveAttemptStatus([{ status: "completed" }])).toBe("completed");
    expect(getCompetitiveAttemptStatus([{ status: "abandoned" }])).toBe("notCompleted");
    expect(getCompetitiveAttemptStatus([{ status: "invalidated" }])).toBe("notCompleted");
  });
});
