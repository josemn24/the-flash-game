import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  competitiveFlash,
  competitiveRoomContext,
  socialSnapshot,
} from "@/test-utils/competitiveGameplay";
import type { CompetitiveGameAppProps } from "./shells/gameAppTypes";
import { RoomChallengeClient } from "./RoomChallengeClient.client";

vi.mock("./shells/GameApp", () => ({
  GameApp: (props: CompetitiveGameAppProps) => (
    <div
      data-persistence={props.persistence}
      data-attempt={props.roomContext.attemptStatus}
      data-review={props.terminalReview?.length ?? 0}
    >
      Partida competitiva
    </div>
  ),
}));

const base = { challenge: competitiveFlash, roomContext: competitiveRoomContext, socialSnapshot };

describe("RoomChallengeClient", () => {
  it.each(["available", "inProgress"] as const)(
    "mounts only server gameplay for %s",
    (attemptStatus) => {
      const markup = renderToStaticMarkup(
        <RoomChallengeClient {...base} roomContext={{ ...base.roomContext, attemptStatus }} />,
      );
      expect(markup).toContain('data-persistence="server"');
      expect(markup).toContain(`data-attempt="${attemptStatus}"`);
    },
  );
  it.each(["expired", "locked"] as const)(
    "does not start an unavailable challenge: %s",
    (availabilityStatus) => {
      const markup = renderToStaticMarkup(
        <RoomChallengeClient {...base} roomContext={{ ...base.roomContext, availabilityStatus }} />,
      );
      expect(markup).not.toContain("Partida competitiva");
      expect(markup).toContain(
        availabilityStatus === "expired" ? "Desafío cerrado" : "Desafío no disponible",
      );
    },
  );
  it("recovers an in-progress attempt even after the publication closes", () => {
    const markup = renderToStaticMarkup(
      <RoomChallengeClient
        {...base}
        roomContext={{
          ...base.roomContext,
          availabilityStatus: "expired",
          attemptStatus: "inProgress",
        }}
      />,
    );
    expect(markup).toContain('data-attempt="inProgress"');
  });
  it.each(["completed", "notCompleted"] as const)(
    "shows consumed %s attempts without starting another game",
    (attemptStatus) => {
      const markup = renderToStaticMarkup(
        <RoomChallengeClient {...base} roomContext={{ ...base.roomContext, attemptStatus }} />,
      );
      expect(markup).not.toContain("Partida competitiva");
      expect(markup).toContain(
        attemptStatus === "completed" ? "Desafío completado" : "Intento no completado",
      );
    },
  );
  it("delegates a completed result and its authorized review to the server shell", () => {
    const markup = renderToStaticMarkup(
      <RoomChallengeClient
        {...base}
        roomContext={{
          ...base.roomContext,
          attemptStatus: "completed",
          result: { completed: true, flashPoints: 80 },
        }}
        terminalReview={[{ challengeItemId: "item", publicPayload: {}, solutionPayload: {} }]}
      />,
    );
    expect(markup).toContain('data-attempt="completed"');
    expect(markup).toContain('data-review="1"');
  });
});
