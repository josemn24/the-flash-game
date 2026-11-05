"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { sessionValidationContext } from "@/features/game/session/sessionResult";
import { useMeasurementAttempt } from "@/components/product/Measurement.client";
import { createRemoteGameSessionProvider } from "@/features/game/session/providers/remote";
import { remoteSessionBootstrap } from "@/features/game/session/providers/remoteBootstrap";
import { usePyramidGameSession } from "@/features/game/usePyramidGameSession";
import type { ServerFlashTerminalReview, ServerPyramidChallenge } from "@/types/gameplay/challenge";
import type { GameRoomContext } from "@/types/view-models/room";
import { PyramidGameView } from "@/components/game/modes/flash-pop/PyramidGameView";

/** Competitive composition: the shared Pyramid view runs on the remote provider. */
export function ServerFlashPopPyramidGame({
  challenge,
  roomContext,
  terminalReview,
}: {
  challenge: ServerPyramidChallenge;
  roomContext: GameRoomContext;
  terminalReview?: readonly ServerFlashTerminalReview[];
}) {
  const router = useRouter();
  const provider = useMemo(
    () =>
      createRemoteGameSessionProvider({
        context: sessionValidationContext(challenge),
        expectedAttemptId: roomContext.attemptId,
      }),
    [challenge, roomContext.attemptId],
  );
  const initialSession = useMemo(
    () => remoteSessionBootstrap(roomContext, terminalReview),
    [roomContext, terminalReview],
  );
  const refresh = useMemo(() => () => router.refresh(), [router]);
  const session = usePyramidGameSession({ challenge, provider, initialSession, refresh });
  useMeasurementAttempt(session.attempt?.id);
  return (
    <PyramidGameView challenge={challenge} session={session} returnTo={roomContext.returnTo} />
  );
}
