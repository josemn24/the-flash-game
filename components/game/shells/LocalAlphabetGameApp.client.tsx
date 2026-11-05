"use client";

import { useState } from "react";
import { AlphabetGameView } from "@/components/game/modes/flash-pop/ServerFlashPopAlphabetGame.client";
import { createLocalAlphabetSessionProvider } from "@/features/game/session/providers/localAlphabet";
import { useAlphabetGameSession } from "@/features/game/useServerAlphabetSession";
import { useChallengeCompletionReporter } from "@/features/game/useChallengeCompletionReporter";
import type { AnswerReview, ChallengeCompletionResult } from "@/types/gameplay/completion";
import type { GameSessionBootstrap } from "@/types/gameplay/authoritative-session";
import type { LocalAlphabetDefinition } from "@/types/gameplay/local-alphabet";

const NEW_SESSION: GameSessionBootstrap = { status: "new", results: [], score: 0 };

/** Local-only Alphabet composition; private fixture answers terminate at the memory authority. */
export function LocalAlphabetGameApp({
  definition,
  onComplete,
  returnTo = "/demo/flash-pop",
}: {
  definition: LocalAlphabetDefinition;
  onComplete?: (result: ChallengeCompletionResult) => void;
  returnTo?: string;
}) {
  const [runId, setRunId] = useState(0);
  return (
    <LocalAlphabetRun
      key={runId}
      definition={definition}
      onComplete={onComplete}
      returnTo={returnTo}
      onReplay={() => setRunId((current) => current + 1)}
    />
  );
}

function LocalAlphabetRun({
  definition,
  onComplete,
  returnTo,
  onReplay,
}: {
  readonly definition: LocalAlphabetDefinition;
  readonly onComplete?: (result: ChallengeCompletionResult) => void;
  readonly returnTo: string;
  readonly onReplay: () => void;
}) {
  const [provider] = useState(() => createLocalAlphabetSessionProvider({ definition }));
  const session = useAlphabetGameSession({
    challenge: definition.challenge,
    provider,
    initialSession: NEW_SESSION,
  });
  const startedAt =
    session.deadlineAt === null
      ? new Date().toISOString()
      : new Date(session.deadlineAt - definition.challenge.timeLimitMs).toISOString();
  const answers: AnswerReview[] = definition.challenge.entries.map((entry) => {
    const answer = session.results.find((result) => result.questionId === entry.id);
    return {
      questionId: entry.id,
      answer: answer?.answer ?? null,
      status: answer?.status ?? "unanswered",
      isCorrect: answer?.isCorrect ?? false,
    };
  });
  const durationMs = Math.round(
    session.results.reduce((total, answer) => total + answer.timeUsed, 0) * 1_000,
  );
  useChallengeCompletionReporter(
    session.phase === "results"
      ? {
          challengeId: definition.challenge.id,
          startedAt,
          flashPoints: session.score,
          completed: true,
          durationMs,
          answers,
        }
      : null,
    onComplete,
  );

  return (
    <AlphabetGameView
      challenge={definition.challenge}
      session={session}
      returnTo={returnTo}
      onReplay={onReplay}
    />
  );
}
