"use client";

import { useEffect, useState } from "react";
import type { GameRoomContext } from "@/types/game";
import {
  useRoomSession,
  type RoomSessionSnapshot,
} from "@/features/rooms/RoomSessionProvider.client";

function snapshotKey(roomContext: GameRoomContext | undefined, challengeId: string) {
  return roomContext ? `${roomContext.roomId}:${challengeId}` : null;
}

export function useRoomAttemptResume<T>(
  roomContext: GameRoomContext | undefined,
  challengeId: string,
  mode: string,
) {
  const { getAttemptSnapshot } = useRoomSession();
  const key = snapshotKey(roomContext, challengeId);
  const [snapshot] = useState<T | undefined>(() => {
    const stored = roomContext ? getAttemptSnapshot(roomContext.roomId, challengeId) : undefined;
    return stored?.mode === mode ? (stored.state as T) : undefined;
  });

  return key ? snapshot : undefined;
}

export function useRoomAttemptSnapshot<T>(
  roomContext: GameRoomContext | undefined,
  challengeId: string,
  mode: string,
  phase: string,
  state: T,
) {
  const { recordAttemptSnapshot, clearAttemptSnapshot } = useRoomSession();

  useEffect(() => {
    if (!roomContext) return;
    if (
      state !== null &&
      state !== undefined &&
      (phase === "countdown" || phase === "playing" || phase === "scene" || phase === "briefing")
    ) {
      const snapshot: RoomSessionSnapshot = { mode, state };
      recordAttemptSnapshot(roomContext.roomId, challengeId, snapshot);
      return;
    }
    if (phase === "results" || phase === "review") {
      clearAttemptSnapshot(roomContext.roomId, challengeId);
    }
  }, [challengeId, clearAttemptSnapshot, mode, phase, recordAttemptSnapshot, roomContext, state]);
}
