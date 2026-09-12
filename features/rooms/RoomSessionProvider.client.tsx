"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { ChallengeCompletion, RoomChallengeResult } from "@/types/game";

type RoomSessionResults = Record<string, Record<string, RoomChallengeResult>>;

export function upsertRoomSessionResult(
  current: RoomSessionResults,
  completion: ChallengeCompletion,
): RoomSessionResults {
  return {
    ...current,
    [completion.roomId]: {
      ...current[completion.roomId],
      [completion.challengeId]: {
        points: completion.points,
        completed: completion.completed,
        attempt: {
          challengeId: completion.challengeId,
          playedAt: completion.playedAt,
          points: completion.points,
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
};

const defaultContext: RoomSessionContextValue = {
  recordCompletion: () => undefined,
  getCompletion: () => undefined,
};

const RoomSessionContext = createContext<RoomSessionContextValue>(defaultContext);

export function RoomSessionProvider({ children }: { children: ReactNode }) {
  const [results, setResults] = useState<RoomSessionResults>({});

  const recordCompletion = useCallback((completion: ChallengeCompletion) => {
    setResults((current) => upsertRoomSessionResult(current, completion));
  }, []);

  const getCompletion = useCallback(
    (roomId: string, challengeId: string) => results[roomId]?.[challengeId],
    [results],
  );

  const value = useMemo(() => ({ recordCompletion, getCompletion }), [recordCompletion, getCompletion]);

  return <RoomSessionContext.Provider value={value}>{children}</RoomSessionContext.Provider>;
}

export function useRoomSession() {
  return useContext(RoomSessionContext);
}
