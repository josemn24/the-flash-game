import { describe, expect, it } from "vitest";
import { dynamic, generateMetadata } from "./page";

describe("room detail route", () => {
  it("exposes the mock room and metadata", async () => {
    expect(dynamic).toBe("force-dynamic");
    await expect(
      generateMetadata({ params: Promise.resolve({ roomId: "tabarnia-room" }) }),
    ).resolves.toMatchObject({
      title: "Tabarnia — Flash Pop",
    });
  });
});
