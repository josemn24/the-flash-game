"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { SurvivalGameView } from "@/components/game/modes/flash-pop/SurvivalGameView";
import { sessionValidationContext } from "@/features/game/session/sessionResult";
import { createRemoteGameSessionProvider } from "@/features/game/session/providers/remote";
import { remoteSessionBootstrap } from "@/features/game/session/providers/remoteBootstrap";
import { useSurvivalGameSession } from "@/features/game/useSurvivalGameSession";
import type {
  ServerFlashTerminalReview,
  ServerSurvivalChallenge,
} from "@/types/gameplay/challenge";
import type { GameRoomContext } from "@/types/view-models/room";

/** Competitive composition: the shared Survival view uses the remote provider. */
export function ServerFlashPopSurvivalGame({
  challenge,
  roomContext,
  terminalReview,
}: {
  challenge: ServerSurvivalChallenge;
  roomContext: GameRoomContext;
  terminalReview?: readonly ServerFlashTerminalReview[];
}) {
  const router = useRouter();
  const provider = useMemo(
    () => createRemoteGameSessionProvider({ context: sessionValidationContext(challenge) }),
    [challenge],
  );
  const initialSession = useMemo(
    () => remoteSessionBootstrap(roomContext, terminalReview),
    [roomContext, terminalReview],
  );
  const refresh = useMemo(() => () => router.refresh(), [router]);
  const session = useSurvivalGameSession({ challenge, provider, initialSession, refresh });
  return (
    <SurvivalGameView
      challenge={challenge}
      session={session}
      returnTo={roomContext.returnTo}
      returnLabel="Volver a la sala"
    />
  );
}
