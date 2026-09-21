import { describe, expect, it } from "vitest";
import { generateMetadata, generateStaticParams } from "./page";

describe("room detail route", () => {
  it("exposes the mock room and metadata", async () => {
    expect(generateStaticParams()).toEqual([{ roomId: "tabarnia-room" }]);
    await expect(generateMetadata({ params: Promise.resolve({ roomId: "tabarnia-room" }) })).resolves.toMatchObject({
      title: "Tabarnia — Flash Pop",
    });
  });
});
