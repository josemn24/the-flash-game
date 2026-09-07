"use client";

import { useCallback } from "react";
import { GameApp } from "@/components/game/shells/GameApp";
import { useRoomSession } from "@/features/rooms/RoomSessionProvider.client";
import type { Challenge, ChallengeCompletion, GameRoomContext } from "@/types/game";

export function RoomChallengeClient({
  challenge,
  roomContext,
}: {
  challenge: Challenge;
  roomContext?: GameRoomContext;
}) {
  const { recordCompletion } = useRoomSession();
  const onComplete = useCallback(
    (result: Omit<ChallengeCompletion, "roomId">) => {
      if (!roomContext) return;
      recordCompletion({ ...result, roomId: roomContext.roomId });
    },
    [recordCompletion, roomContext],
  );

  return (
    <GameApp
      challenge={challenge}
      roomContext={roomContext}
      onComplete={roomContext ? onComplete : undefined}
    />
  );
}
