import { describe, expect, it } from "vitest";
import {
  parseScheduleArgs,
  resolveScheduleProfile,
  scheduleInterval,
  scheduleSeason,
} from "./schedule-profile.mjs";

const usage = "Uso: seed --schedule <production|fast|Nm|Nh>";

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

  it.each([
    ["10m", 10],
    ["30m", 30],
    ["1h", 60],
    ["60m", 60],
    ["90m", 90],
    ["2h", 120],
  ])("normalizes %s into a reusable minute profile", (schedule, minutes) => {
    const profile = resolveScheduleProfile(schedule);
    expect(profile).toMatchObject({
      name: `${minutes}m`,
      windowMinutes: minutes,
      windowStep: minutes,
      windowUnit: "minutes",
    });
    expect(resolveScheduleProfile(profile.name)).toEqual(profile);
    expect(parseScheduleArgs(["--schedule", schedule], usage)).toEqual({ schedule: `${minutes}m` });
  });

  it.each([
    "",
    "0m",
    "0h",
    "-5m",
    "1.5h",
    "10",
    "10min",
    "1h30m",
    "1d",
    "1H",
    " 10m",
    "10m ",
    "10m\n",
    "1e3m",
    "Infinityh",
    "5m';select 1",
  ])("rejects invalid duration %j", (schedule) =>
    expect(() => parseScheduleArgs(["--schedule", schedule], usage)).toThrow(),
  );

  it.each(["9007199254740993m", "150000000000m", "999999999999999999999999h"])(
    "rejects arithmetic or timestamp overflow for %s",
    (schedule) => expect(() => resolveScheduleProfile(schedule)).toThrow("rango de fechas"),
  );

  it("validates the full season span and the selected start", () => {
    const large = resolveScheduleProfile("20000000000m");
    expect(scheduleSeason(large, 6, "betavip").durationMinutes).toBe(120000000000);
    expect(() => scheduleSeason(large, 8, "tabarnia")).toThrow("rango de fechas");
    const nearLimit = resolveScheduleProfile("143950000000m");
    expect(() => scheduleSeason(nearLimit, 1, "tabarnia", "9999-01-01T00:00:00Z")).toThrow(
      "rango de fechas",
    );
  });

  it("retains production season lengths and derives fast lengths from the actual count", () => {
    const production = resolveScheduleProfile();
    expect(scheduleSeason(production, 8, "tabarnia")).toEqual({
      durationMinutes: 24480,
      endInterval: "17 days",
    });
    expect(scheduleSeason(production, 6, "betavip")).toEqual({
      durationMinutes: 8640,
      endInterval: "144 hours",
    });
    expect(scheduleSeason(resolveScheduleProfile("fast"), 8, "tabarnia")).toEqual({
      durationMinutes: 40,
      endInterval: "40 minutes",
    });
    expect(scheduleSeason(resolveScheduleProfile("fast"), 7, "betavip")).toEqual({
      durationMinutes: 35,
      endInterval: "35 minutes",
    });
  });

  it("keeps explicit start precision and combines CLI options in either order", () => {
    const startsAt = "2099-10-20T19:00:20.168+02:00";
    const normalized = "2099-10-20T17:00:20.168Z";
    for (const args of [
      ["--schedule", "1h", "--starts-at", startsAt],
      ["--starts-at", startsAt, "--schedule", "1h"],
    ]) {
      expect(parseScheduleArgs(args, usage)).toEqual({ schedule: "60m", startsAt: normalized });
    }
    expect(scheduleInterval(resolveScheduleProfile("1h"), 2, startsAt)).toBe(
      `'${normalized}'::timestamptz + interval '120 minutes'`,
    );
    expect(scheduleInterval(resolveScheduleProfile("30m"), 1)).toBe(
      "date_trunc('minute', now()) + interval '30 minutes'",
    );
  });
});
