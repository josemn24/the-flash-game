import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { SBR_QUESTIONS } from "./sbr.mjs";
import { SBR_MAP_OUTPUT, rasterizeSbrMap } from "../../generate-sbr-assets.mjs";

describe("Steel Ball Run persisted fixture", () => {
  it("keeps the complete 16-question selection and 100 points", () => {
    expect(SBR_QUESTIONS).toHaveLength(16);
    expect(SBR_QUESTIONS.reduce((total, item) => total + item.points, 0)).toBe(100);
    expect(SBR_QUESTIONS.map((item) => item.slug)).toEqual([
      "sbr-fire-horse-year",
      "sbr-equidae-odd-one-out",
      "sbr-currency-matching",
      "sbr-west-to-east-cities",
      "sbr-grand-canyon-progressive",
      "sbr-grand-canyon-heat-map",
      "sbr-average-speed",
      "sbr-1890-gear-classification",
      "sbr-race-anagram",
      "sbr-pony-express",
      "sbr-horses-sleep-standing",
      "sbr-steel-composition",
      "sbr-horse-gaits",
      "sbr-bernoulli-principle",
      "sbr-overtake-second-trap",
      "sbr-creator",
    ]);
    expect(SBR_QUESTIONS.filter((item) => item.points === 7)).toHaveLength(4);
    expect(SBR_QUESTIONS.filter((item) => item.points === 6)).toHaveLength(12);
  });

  it("keeps the heat-map solution private and the persisted public contract v2", () => {
    const item = SBR_QUESTIONS.find((candidate) => candidate.slug === "sbr-grand-canyon-heat-map");
    expect(item.payloadSchemaVersion).toBe(2);
    expect(item.publicPayload.surface).toMatchObject({
      assetId: "__SBR_ASSET_ID__",
      width: 1859,
      height: 968,
    });
    expect(item.publicPayload).not.toHaveProperty("target");
    expect(item.solutionPayload).toMatchObject({
      target: { x: 0.226, y: 0.537 },
      fullCreditRadius: 0.04,
      toleranceRadius: 0.12,
    });
  });

  it("produces a stable PNG with the source SVG dimensions", async () => {
    const before = await readFile(SBR_MAP_OUTPUT);
    const beforeHash = createHash("sha256").update(before).digest("hex");
    const generated = await rasterizeSbrMap();
    const after = await readFile(SBR_MAP_OUTPUT);
    const metadata = await sharp(after).metadata();

    expect(generated).toMatchObject({ width: 1859, height: 968, format: "png" });
    expect(metadata).toMatchObject({ format: "png", width: 1859, height: 968 });
    expect(after.byteLength).toBeGreaterThan(0);
    expect(createHash("sha256").update(after).digest("hex")).toBe(beforeHash);
    expect(path.basename(SBR_MAP_OUTPUT)).toBe("usa-location-map.png");
  });
});
