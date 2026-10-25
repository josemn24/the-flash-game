import { describe, expect, it } from "vitest";
import { calculateSeasonMeasurement, seasonMeasurementCsv } from "./seasonMeasurement";
import { seasonSources } from "@/test-utils/seasonMeasurement";

describe("automatic season reports", () => {
  it("keeps nonplayers and distinguishes late joins, official defeats and practice", () => {
    const report = calculateSeasonMeasurement(seasonSources());
    expect(report.opportunities).toBe(3);
    expect(report.metrics).toMatchObject({
      competitiveStarts: 2,
      competitiveCompletions: 1,
      returningPeople: 1,
      practiceCompletions: 2,
      roomVisits: 2,
    });
    expect(report.activePeople).toBe(1);
    expect(report.cells.find((c) => c.playerId === "bob" && c.publicationId === "d1")?.status).toBe(
      "unavailable",
    );
    expect(
      report.cells.find((c) => c.playerId === "alice" && c.publicationId === "d1")?.score,
    ).toBe(0);
    expect(report.publications[0]).toMatchObject({ enjoyment: 4, ratingCount: 1 });
    expect(report.participants[1].metrics.competitiveStarts).toBe(0);
  });
  it("exports individual participation with season identity and neutralizes spreadsheet formulas", () => {
    const report = calculateSeasonMeasurement(seasonSources());
    const csv = seasonMeasurementCsv(report, "participation");
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("'=Alice");
    expect(csv).toContain('"unavailable"');
    expect(csv).toContain(report.sources.season!.seasonId);
    expect(csv.split("\r\n")).toHaveLength(6);
  });
  it("does not count future challenges or cancelled publications as missed opportunities", () => {
    const sources = seasonSources();
    sources.publications[0].status = "cancelled";
    sources.publications[1].opensAt = "2026-10-25T00:00:00Z";
    sources.publications[1].closesAt = "2026-10-26T00:00:00Z";
    sources.attempts = [];
    sources.events = [];
    sources.ratings = [];
    const report = calculateSeasonMeasurement(sources);
    expect(report.opportunities).toBe(0);
    expect(report.publications).toHaveLength(1);
    expect(report.cells.every((c) => c.status === "upcoming")).toBe(true);
  });
  it("counts recurrence from distinct starts even without any completed challenge", () => {
    const sources = seasonSources();
    sources.attempts = sources.attempts.filter((a) => a.kind === "competitive");
    sources.attempts[0].status = "abandoned";
    const report = calculateSeasonMeasurement(sources);
    expect(report.metrics.competitiveStarts).toBe(2);
    expect(report.metrics.competitiveCompletions).toBe(0);
    expect(report.metrics.returningPeople).toBe(1);
    sources.attempts[1].status = "invalidated";
    expect(calculateSeasonMeasurement(sources).metrics.returningPeople).toBe(0);
  });
  it("exports recurrence across the season without implying zero recurrence per challenge", () => {
    const report = calculateSeasonMeasurement(seasonSources());
    for (const dataset of ["summary", "participants"] as const)
      expect(seasonMeasurementCsv(report, dataset).split("\r\n")[0]).toContain(
        '"Personas que vuelven"',
      );
    const challengeCsv = seasonMeasurementCsv(report, "challenges");
    expect(challengeCsv.split("\r\n")[0]).not.toContain('"Personas que vuelven"');
    expect(challengeCsv).toContain('"Partidas iniciadas"');
    expect(challengeCsv).toContain('"enjoyment_median"');
  });
});
