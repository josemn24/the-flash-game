import { describe, expect, it } from "vitest";
import { FLASH_POP_FLASH_PILOT_ID } from "@/features/flash-pop/demoSocial";
import { generateStaticParams } from "./page";

describe("Flash Pop Flash preview route", () => {
  it("only exposes the pilot challenge", () => {
    expect(generateStaticParams()).toEqual([{ challengeId: FLASH_POP_FLASH_PILOT_ID }]);
  });
});
