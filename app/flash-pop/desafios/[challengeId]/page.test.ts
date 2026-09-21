import { describe, expect, it } from "vitest";
import { generateStaticParams } from "./page";
import { FLASH_POP_PREVIEW_CHALLENGE_IDS } from "@/features/flash-pop/demoSocial";

describe("legacy Flash Pop Pyramid route", () => {
  it("only exposes the two migrated challenges for canonical redirects", () => {
    expect(generateStaticParams()).toEqual(
      FLASH_POP_PREVIEW_CHALLENGE_IDS.map((challengeId) => ({ challengeId })),
    );
  });
});
