"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { ChallengeCompletion, RoomChallengeResult } from "@/types/game";

type RoomSessionResults = Record<string, Record<string, RoomChallengeResult>>;
export type RoomSessionSnapshot = {
  mode: string;
  state: unknown;
};
type RoomSessionSnapshots = Record<string, Record<string, RoomSessionSnapshot>>;

export function upsertRoomSessionResult(
  current: RoomSessionResults,
  completion: ChallengeCompletion,
): RoomSessionResults {
  const previous = current[completion.roomId]?.[completion.challengeId];
  if (previous) return current;

  return {
    ...current,
    [completion.roomId]: {
      ...current[completion.roomId],
      [completion.challengeId]: {
        flashPoints: completion.flashPoints,
        completed: completion.completed,
        attempt: {
          challengeId: completion.challengeId,
          startedAt: completion.startedAt,
          playedAt: completion.playedAt,
          durationMs: completion.durationMs,
          flashPoints: completion.flashPoints,
          completed: completion.completed,
          answers: completion.answers,
        },
      },
    },
  };
}

type RoomSessionContextValue = {
  recordCompletion: (completion: ChallengeCompletion) => void;
  getCompletion: (roomId: string, challengeId: string) => RoomChallengeResult | undefined;
  recordAttemptSnapshot: (
    roomId: string,
    challengeId: string,
    snapshot: RoomSessionSnapshot,
  ) => void;
  getAttemptSnapshot: (roomId: string, challengeId: string) => RoomSessionSnapshot | undefined;
  clearAttemptSnapshot: (roomId: string, challengeId: string) => void;
};

const defaultContext: RoomSessionContextValue = {
  recordCompletion: () => undefined,
  getCompletion: () => undefined,
  recordAttemptSnapshot: () => undefined,
  getAttemptSnapshot: () => undefined,
  clearAttemptSnapshot: () => undefined,
};

const RoomSessionContext = createContext<RoomSessionContextValue>(defaultContext);

export function RoomSessionProvider({ children }: { children: ReactNode }) {
  const [results, setResults] = useState<RoomSessionResults>({});
  const [snapshots, setSnapshots] = useState<RoomSessionSnapshots>({});

  const recordCompletion = useCallback((completion: ChallengeCompletion) => {
    setResults((current) => upsertRoomSessionResult(current, completion));
    setSnapshots((current) => {
      if (!current[completion.roomId]?.[completion.challengeId]) return current;
      const roomSnapshots = { ...current[completion.roomId] };
      delete roomSnapshots[completion.challengeId];
      return { ...current, [completion.roomId]: roomSnapshots };
    });
  }, []);

  const getCompletion = useCallback(
    (roomId: string, challengeId: string) => results[roomId]?.[challengeId],
    [results],
  );

  const recordAttemptSnapshot = useCallback(
    (roomId: string, challengeId: string, snapshot: RoomSessionSnapshot) => {
      setSnapshots((current) => {
        const previous = current[roomId]?.[challengeId];
        if (previous && JSON.stringify(previous) === JSON.stringify(snapshot)) return current;
        return {
          ...current,
          [roomId]: {
            ...current[roomId],
            [challengeId]: snapshot,
          },
        };
      });
    },
    [],
  );

  const getAttemptSnapshot = useCallback(
    (roomId: string, challengeId: string) => snapshots[roomId]?.[challengeId],
    [snapshots],
  );

  const clearAttemptSnapshot = useCallback((roomId: string, challengeId: string) => {
    setSnapshots((current) => {
      if (!current[roomId]?.[challengeId]) return current;
      const roomSnapshots = { ...current[roomId] };
      delete roomSnapshots[challengeId];
      return { ...current, [roomId]: roomSnapshots };
    });
  }, []);

  const value = useMemo(
    () => ({
      recordCompletion,
      getCompletion,
      recordAttemptSnapshot,
      getAttemptSnapshot,
      clearAttemptSnapshot,
    }),
    [
      recordCompletion,
      getCompletion,
      recordAttemptSnapshot,
      getAttemptSnapshot,
      clearAttemptSnapshot,
    ],
  );

  return <RoomSessionContext.Provider value={value}>{children}</RoomSessionContext.Provider>;
}

export function useRoomSession() {
  return useContext(RoomSessionContext);
}
