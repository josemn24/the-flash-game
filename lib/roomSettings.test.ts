import { describe, expect, it } from "vitest";
import { demoRoom } from "@/data/demoRoom";
import { buildRoomSettingsModel } from "./roomSettings";

describe("room settings model", () => {
  it("derives the room identity and member presentation data", () => {
    const model = buildRoomSettingsModel(demoRoom);

    expect(model).toMatchObject({
      roomId: "tabarnia-room",
      title: "Tabarnia",
      currentUserId: "player",
      memberCount: 5,
    });
    expect(model.members).toHaveLength(5);
    expect(model.members.find((member) => member.id === "player")).toMatchObject({
      name: "Jugador",
      totalPoints: 136,
      isCurrentUser: true,
    });
    expect(model.members.filter((member) => member.isCurrentUser)).toHaveLength(1);
  });
});
