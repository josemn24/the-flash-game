import { describe, expect, it } from "vitest";
import { generateStaticParams, FLASH_POP_FLASH_PILOT_ID } from "./page";

describe("Flash Pop Flash preview route", () => {
  it("only exposes the pilot challenge", () => {
    expect(generateStaticParams()).toEqual([{ challengeId: FLASH_POP_FLASH_PILOT_ID }]);
  });
});
