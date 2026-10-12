import { describe, expect, it } from "vitest";
import {
  getFlashPopChallengePageModel,
  getFlashPopLobbyPageModel,
} from "@/server/demo-data-access";

describe("demo server composition", () => {
  it("loads the Flash Pop lobby from the mock composition", async () => {
    const model = await getFlashPopLobbyPageModel();
    if (!model) throw new Error("Expected the demo lobby to be available.");

    expect(model.primary.challenge.mode).toBe("pyramid");
    expect(model.secondary.challenge.mode).toBe("pyramid");
  });

  it("loads Flash Pop challenges without a room route selector", async () => {
    const model = await getFlashPopChallengePageModel("tabarnia-challenge-05");

    expect(model?.challenge.mode).toBe("pyramid");
  });
});
