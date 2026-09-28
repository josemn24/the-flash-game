import { describe, expect, it } from "vitest";
import { getMatchingPairPresentation, MATCHING_PAIR_TONES } from "./matchingPairPresentation";

const leftItems = [{ id: "left-1" }, { id: "left-2" }, { id: "left-3" }];

describe("getMatchingPairPresentation", () => {
  it("uses the left-column order for stable pair numbers and tones", () => {
    const presentation = getMatchingPairPresentation(leftItems, {
      "left-3": "right-3",
      "left-1": "right-1",
    });

    expect(presentation.byLeft["left-1"]).toMatchObject({
      rightId: "right-1",
      pairNumber: 1,
      pairTone: "violet",
    });
    expect(presentation.byLeft["left-3"]).toMatchObject({
      rightId: "right-3",
      pairNumber: 3,
      pairTone: "amber",
    });
  });

  it("exposes the same presentation from both sides of a pair", () => {
    const presentation = getMatchingPairPresentation(leftItems, { "left-2": "right-2" });

    expect(presentation.byLeft["left-2"]).toEqual(presentation.byRight["right-2"]);
  });

  it("cycles deterministically after the six available tones", () => {
    const items = Array.from({ length: MATCHING_PAIR_TONES.length + 1 }, (_, index) => ({
      id: `left-${index + 1}`,
    }));
    const answer = Object.fromEntries(items.map((item, index) => [item.id, `right-${index + 1}`]));
    const presentation = getMatchingPairPresentation(items, answer);

    expect(presentation.byLeft["left-7"]).toMatchObject({
      pairNumber: 7,
      pairTone: MATCHING_PAIR_TONES[0],
    });
  });
});
