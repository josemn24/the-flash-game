import { describe, expect, it } from "vitest";
import { buildCalendarChange, type CalendarEditorRequest } from "./calendarChange";
import { resolveLocalDateTime } from "./zonedDateTime";
import type { SuperadminPortalRoom, SuperadminCalendarEntry } from "@/types/view-models";

const room: SuperadminPortalRoom = {
  roomId: "room",
  slug: "room",
  title: "Room",
  timeZone: "Europe/Madrid",
  status: "active",
  seasons: [
    {
      seasonId: "season",
      title: "Season",
      status: "active",
      startsAt: "2030-09-20T10:00:20.168123Z",
      endsAt: "2030-09-20T11:00:20.168123Z",
      updatedAt: "version",
    },
  ],
};
const entries = [0, 1].map((index) => ({
  scheduledChallengeId: `publication-${index}`,
  seasonId: "season",
  number: index + 1,
  status: "scheduled",
  opensAt: index ? "2030-09-20T10:05:20.168123Z" : room.seasons[0].startsAt,
  closesAt: index ? "2030-09-20T10:10:20.168123Z" : "2030-09-20T10:05:20.168123Z",
  updatedAt: "version",
  calendarPermissions: { canEditWindow: true, canExtendClose: false, blockedReason: null },
})) as SuperadminCalendarEntry[];
const request: CalendarEditorRequest = {
  roomId: "room",
  seasonId: "season",
  expectedUpdatedAt: "version",
  expectedPublications: entries.map((entry) => ({
    id: entry.scheduledChallengeId,
    updatedAt: entry.updatedAt,
  })),
  startsAtLocal: "2030-09-20T12:00",
  endsAtLocal: "2030-09-20T13:00",
  opensAtLocal: "2030-09-20T12:00",
  closesAtLocal: "2030-09-20T12:05",
  scope: "single",
  expandSeason: false,
};

describe("calendar change proposals", () => {
  it("preserves every microsecond when saving the displayed values unchanged", () => {
    const proposal = buildCalendarChange(
      { ...request, scheduledChallengeId: "publication-0" },
      room,
      entries,
    );
    expect(proposal.startsAt).toBe(room.seasons[0].startsAt);
    expect(proposal.endsAt).toBe(room.seasons[0].endsAt);
    expect(proposal.publications[0].opensAt).toBe(entries[0].opensAt);
    expect(proposal.publications[0].closesAt).toBe(entries[0].closesAt);
  });
  it("resolves only an edited field to the chosen exact minute", () => {
    const proposal = buildCalendarChange(
      { ...request, scheduledChallengeId: "publication-0", closesAtLocal: "2030-09-20T12:04" },
      room,
      entries,
    );
    expect(proposal.publications[0].opensAt).toBe(entries[0].opensAt);
    expect(proposal.publications[0].closesAt).toBe("2030-09-20T10:04:00.000Z");
  });
  it("moves following publications with the same exact displacement and keeps duration and adjacency", () => {
    const proposal = buildCalendarChange(
      {
        ...request,
        scheduledChallengeId: "publication-0",
        scope: "following",
        opensAtLocal: "2030-09-20T12:10",
      },
      room,
      entries,
    );
    expect(proposal.publications.map((entry) => [entry.opensAt, entry.closesAt])).toEqual([
      ["2030-09-20T10:10:00.000000Z", "2030-09-20T10:15:00.000000Z"],
      ["2030-09-20T10:15:00.000000Z", "2030-09-20T10:20:00.000000Z"],
    ]);
  });
  it("requires an explicit choice to extend the season", () => {
    const changed = {
      ...request,
      scheduledChallengeId: "publication-0",
      scope: "following" as const,
      opensAtLocal: "2030-09-20T13:00",
    };
    expect(buildCalendarChange(changed, room, entries).endsAt).toBe(room.seasons[0].endsAt);
    expect(buildCalendarChange({ ...changed, expandSeason: true }, room, entries).endsAt).toBe(
      "2030-09-20T11:10:00.000000Z",
    );
  });
  it("includes blocked following publications so the server can reject the entire proposal", () => {
    const blocked = entries.map((entry) => ({
      ...entry,
      status: "closed" as const,
      calendarPermissions: {
        canEditWindow: false,
        canExtendClose: false,
        blockedReason: "schedule_finished",
      },
    }));
    expect(
      buildCalendarChange(
        { ...request, scheduledChallengeId: "publication-0", scope: "following" },
        room,
        blocked,
      ).publications,
    ).toHaveLength(2);
  });
  it("rejects a changed or newly inserted publication before constructing a preview", () => {
    expect(() =>
      buildCalendarChange(request, room, [
        ...entries,
        { ...entries[0], scheduledChallengeId: "new" },
      ]),
    ).toThrow("schedule_conflict");
    expect(() =>
      buildCalendarChange({ ...request, expectedUpdatedAt: "old" }, room, entries),
    ).toThrow("schedule_conflict");
  });
  it("preserves the second DST occurrence when untouched and uses the first for a new ambiguous value", () => {
    expect(
      resolveLocalDateTime("2026-10-25T02:30", room.timeZone, "2026-10-25T01:30:20.168123Z"),
    ).toBe("2026-10-25T01:30:20.168123Z");
    expect(resolveLocalDateTime("2026-10-25T02:30", room.timeZone)).toBe(
      "2026-10-25T00:30:00.000Z",
    );
    expect(() => resolveLocalDateTime("2026-03-29T02:30", room.timeZone)).toThrow("does not exist");
  });
});
