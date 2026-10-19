"use client";

import { useEffect, useState } from "react";
import type { GameSessionProvider } from "@/application/ports/game-session";
import { Button, Canvas, Card } from "@/components/ui";
import { createLocalPyramidSessionProvider } from "@/features/game/session/providers/localPyramid";
import { usePyramidGameSession } from "@/features/game/usePyramidGameSession";
import { useChallengeCompletionReporter } from "@/features/game/useChallengeCompletionReporter";
import { sumEffectiveDurationMs } from "@/lib/challengeRanking";
import { loadMiniWordleDictionary } from "@/lib/miniWordleDictionary";
import type { LocalPyramidDefinition } from "@/types/gameplay/local-pyramid";
import type { ChallengeCompletionResult } from "@/types/gameplay/completion";
import type { GameSessionBootstrap } from "@/types/gameplay/authoritative-session";
import { PyramidGameView } from "../modes/flash-pop/PyramidGameView";

const NEW_SESSION: GameSessionBootstrap = { status: "new", results: [], score: 0 };
type Dictionaries = ReadonlyMap<string, ReadonlySet<string>>;
type LocalPyramidProps = {
  readonly definition: LocalPyramidDefinition;
  readonly onComplete?: (result: ChallengeCompletionResult) => void;
  readonly returnTo?: string;
};
type DictionaryState =
  | { readonly kind: "loading" | "error" }
  | { readonly kind: "ready"; readonly dictionaries: Dictionaries };

/** Only this composition receives private mock definitions. Each keyed run owns its authority. */
export function LocalPyramidGameApp(props: LocalPyramidProps) {
  const [runId, setRunId] = useState(0);
  return (
    <PreparedPyramidRun
      key={`${props.definition.challenge.id}:${props.definition.challenge.attemptVersion}:${runId}`}
      {...props}
      onReplay={() => setRunId((current) => current + 1)}
    />
  );
}

function PreparedPyramidRun(props: LocalPyramidProps & { readonly onReplay: () => void }) {
  // A definition/version is immutable for the lifetime of a run, even if a parent rerenders.
  const [definition] = useState(() => structuredClone(props.definition));
  const [requiredDictionaries] = useState(() => {
    const required = new Map<string, 4 | 5>();
    for (const level of definition.levels) {
      if (level.publicQuestion.type === "mini-wordle" && level.solution.type === "mini-wordle")
        required.set(level.solution.payload.dictionaryId, level.publicQuestion.payload.wordLength);
    }
    return required;
  });
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [dictionaryState, setDictionaryState] = useState<DictionaryState>(() =>
    requiredDictionaries.size ? { kind: "loading" } : { kind: "ready", dictionaries: new Map() },
  );
  useEffect(() => {
    if (!requiredDictionaries.size) return;
    let current = true;
    void Promise.all(
      [...requiredDictionaries].map(
        async ([id, length]) => [id, await loadMiniWordleDictionary(length)] as const,
      ),
    ).then(
      (entries) => {
        if (current) setDictionaryState({ kind: "ready", dictionaries: new Map(entries) });
      },
      () => {
        if (current) setDictionaryState({ kind: "error" });
      },
    );
    return () => {
      current = false;
    };
  }, [requiredDictionaries, loadAttempt]);

  if (dictionaryState.kind !== "ready") {
    return (
      <Canvas maxWidth="content">
        <Card>
          {dictionaryState.kind === "error" ? (
            <>
              <p role="alert">No se pudo cargar el diccionario.</p>
              <Button
                onClick={() => {
                  setDictionaryState({ kind: "loading" });
                  setLoadAttempt((current) => current + 1);
                }}
              >
                Reintentar
              </Button>
            </>
          ) : (
            <p role="status">Cargando diccionario…</p>
          )}
        </Card>
      </Canvas>
    );
  }
  return (
    <LocalPyramidRun
      {...props}
      definition={definition}
      dictionaries={dictionaryState.dictionaries}
    />
  );
}

function LocalPyramidRun({
  definition,
  dictionaries,
  onComplete,
  returnTo = "/demo/flash-pop",
  onReplay,
}: LocalPyramidProps & { readonly dictionaries: Dictionaries; readonly onReplay: () => void }) {
  const [{ provider, completion }] = useState(() => {
    const authority = createLocalPyramidSessionProvider({ definition, dictionaries });
    const completion = { startedAt: "", confirmed: false };
    const provider: GameSessionProvider = {
      async execute(command, options) {
        const result = await authority.execute(command, options);
        if (result.kind === "accepted") {
          if (command.operation === "start" && !completion.startedAt)
            completion.startedAt = new Date().toISOString();
          if (result.effect === "completed")
            completion.confirmed = result.state.status !== "abandoned";
        }
        return result;
      },
    };
    return { provider, completion };
  });
  const session = usePyramidGameSession({
    challenge: definition.challenge,
    provider,
    initialSession: NEW_SESSION,
  });
  useChallengeCompletionReporter(
    completion.confirmed &&
      (session.phase === "results" || session.phase === "review") &&
      session.pyramidProgress.outcome !== "in_progress"
      ? {
          challengeId: definition.challenge.id,
          startedAt: completion.startedAt,
          flashPoints: session.score,
          completed: true,
          durationMs: sumEffectiveDurationMs(session.results),
          answers: session.results,
        }
      : null,
    onComplete,
  );
  return (
    <PyramidGameView
      challenge={definition.challenge}
      session={session}
      returnTo={returnTo}
      prefetchReturnTo={false}
      onReplay={onReplay}
    />
  );
}
