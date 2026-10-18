"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
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
  const provider = useMemo(() => createRemoteGameSessionProvider(), []);
  const initialSession = useMemo(
    () => remoteSessionBootstrap(roomContext, terminalReview),
    [roomContext, terminalReview],
  );
  const refresh = useMemo(() => () => router.refresh(), [router]);
  const session = usePyramidGameSession({ challenge, provider, initialSession, refresh });
  return (
    <PyramidGameView challenge={challenge} session={session} returnTo={roomContext.returnTo} />
  );
}
