import { describe, expect, it } from "vitest";
import { isValidTimeZone, localDateTimeToUtc, utcToLocalDateTime } from "@/lib/zonedDateTime";

describe("zoned date-time conversion", () => {
  it("converts Europe/Madrid summer time to UTC", () => {
    expect(localDateTimeToUtc("2026-09-20T12:30", "Europe/Madrid").toISOString()).toBe(
      "2026-09-20T10:30:00.000Z",
    );
  });

  it("rejects a local time that does not exist during the spring DST gap", () => {
    expect(() => localDateTimeToUtc("2026-03-29T02:30", "Europe/Madrid")).toThrow("does not exist");
  });

  it("chooses the first occurrence during the autumn DST overlap", () => {
    expect(localDateTimeToUtc("2026-10-25T02:30", "Europe/Madrid").toISOString()).toBe(
      "2026-10-25T00:30:00.000Z",
    );
  });

  it("formats persisted UTC values in the room time zone", () => {
    expect(utcToLocalDateTime("2026-09-20T10:30:00.000Z", "Europe/Madrid")).toBe(
      "2026-09-20T12:30",
    );
  });

  it("rejects invalid calendar values and zones", () => {
    expect(isValidTimeZone("Europe/Madrid")).toBe(true);
    expect(isValidTimeZone("Not/AZone")).toBe(false);
    expect(() => localDateTimeToUtc("2026-02-30T12:00", "Europe/Madrid")).toThrow();
    expect(() => localDateTimeToUtc("2026-09-20T12:00", "Not/AZone")).toThrow();
  });
});
