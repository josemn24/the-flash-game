import { describe, expect, it } from "vitest";
import { parseScheduleArgs, resolveScheduleProfile } from "./schedule-profile.mjs";

const usage = "Uso: seed --schedule <production|fast>";

describe("schedule profiles", () => {
  it("defaults to the production schedule and accepts fast", () => {
    expect(parseScheduleArgs([], usage)).toEqual({ schedule: "production" });
    expect(parseScheduleArgs(["--schedule", "fast"], usage)).toEqual({ schedule: "fast" });
    expect(resolveScheduleProfile("production").windowMinutes).toBe(1440);
    expect(resolveScheduleProfile("fast").windowMinutes).toBe(5);
  });

  it("rejects unknown or incomplete schedule arguments", () => {
    expect(() => parseScheduleArgs(["--schedule", "hourly"], usage)).toThrow(
      "Perfil de calendario no válido",
    );
    expect(() => parseScheduleArgs(["--schedule"], usage)).toThrow(usage);
    expect(() => parseScheduleArgs(["--unknown"], usage)).toThrow(usage);
  });
});
