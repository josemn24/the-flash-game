"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { FlashGameView } from "@/components/game/modes/flash-pop/FlashGameView";
import { createRemoteGameSessionProvider } from "@/features/game/session/providers/remote";
import { remoteSessionBootstrap } from "@/features/game/session/providers/remoteBootstrap";
import { useFlashGameSession } from "@/features/game/useFlashGameSession";
import type { GameRoomContext } from "@/types/view-models/room";
import type { ServerFlashChallenge, ServerFlashTerminalReview } from "@/types/gameplay/challenge";

export function ServerFlashPopGame({
  challenge,
  roomContext,
  terminalReview,
}: {
  challenge: ServerFlashChallenge;
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
  const session = useFlashGameSession({ challenge, provider, initialSession, refresh });
  return <FlashGameView challenge={challenge} session={session} returnTo={roomContext.returnTo} />;
}
