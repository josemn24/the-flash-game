"use client";

import { useCallback } from "react";
import { GameApp } from "@/components/game/shells/GameApp";
import { useRoomSession } from "@/features/rooms/RoomSessionProvider.client";
import type { Challenge, ChallengeCompletionResult, GameRoomContext } from "@/types/game";
import type { FlashPopSocialSnapshot } from "@/types/view-models";

export function RoomChallengeClient({
  challenge,
  roomContext,
  socialSnapshot,
}: {
  challenge: Challenge;
  roomContext?: GameRoomContext;
  socialSnapshot: FlashPopSocialSnapshot;
}) {
  const { recordCompletion } = useRoomSession();
  const onComplete = useCallback(
    (result: ChallengeCompletionResult) => {
      if (!roomContext) return;
      recordCompletion({ ...result, roomId: roomContext.roomId });
    },
    [recordCompletion, roomContext],
  );

  return (
    <GameApp
      challenge={challenge}
      roomContext={roomContext}
      socialSnapshot={socialSnapshot}
      onComplete={roomContext ? onComplete : undefined}
    />
  );
}
