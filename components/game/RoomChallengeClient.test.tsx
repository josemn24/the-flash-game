import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { legacyChallenges } from "@/data/mock/legacyChallengeAdapter";
import { RoomChallengeClient } from "./RoomChallengeClient.client";

const challenge = legacyChallenges[0]!;
const socialSnapshot = {
  currentPlayer: { id: "player", displayName: "Kike", initials: "KI", tone: "social" as const },
  players: [],
  peers: [],
};

describe("RoomChallengeClient", () => {
  it("does not mount a competitive game for a completed attempt", () => {
    const markup = renderToStaticMarkup(
      <RoomChallengeClient
        challenge={challenge}
        roomContext={{
          roomId: "tabarnia-room",
          roomTitle: "Tabarnia",
          returnTo: "/salas/tabarnia-room",
          memberId: "player",
          availabilityStatus: "available",
          attemptStatus: "completed",
          result: {
            flashPoints: 80,
            completed: true,
            attempt: {
              challengeId: challenge.id,
              playedAt: "2026-09-13T10:00:00.000Z",
              flashPoints: 80,
              completed: true,
              answers: [],
            },
          },
        }}
        socialSnapshot={socialSnapshot}
      />,
    );

    expect(markup).toContain("Desafío completado");
    expect(markup).toContain("80 de 100 puntos");
    expect(markup).not.toContain("Empezar desafío");
    expect(markup).not.toContain("Volver a jugar");
  });

  it("does not create an attempt for a closed challenge that was never started", () => {
    const markup = renderToStaticMarkup(
      <RoomChallengeClient
        challenge={challenge}
        roomContext={{
          roomId: "tabarnia-room",
          roomTitle: "Tabarnia",
          returnTo: "/salas/tabarnia-room",
          memberId: "player",
          availabilityStatus: "expired",
          attemptStatus: "available",
        }}
        socialSnapshot={socialSnapshot}
      />,
    );

    expect(markup).toContain("Desafío cerrado");
    expect(markup).toContain("No se creó ningún intento competitivo");
    expect(markup).not.toContain("Empezar desafío");
  });
});
