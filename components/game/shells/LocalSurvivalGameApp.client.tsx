"use client";

import { useState } from "react";
import { SurvivalGameView } from "@/components/game/modes/flash-pop/SurvivalGameView";
import { createLocalSurvivalSessionProvider } from "@/features/game/session/providers/localSurvival";
import { useSurvivalGameSession } from "@/features/game/useSurvivalGameSession";
import type { GameSessionBootstrap } from "@/types/gameplay/authoritative-session";
import type { LocalSurvivalDefinition } from "@/types/gameplay/local-pyramid";

const NEW_SESSION: GameSessionBootstrap = { status: "new", results: [], score: 0 };

/** Local-only composition; private fixture answers stop at the in-memory provider. */
export function LocalSurvivalGameApp({ definition }: { definition: LocalSurvivalDefinition }) {
  const [runId, setRunId] = useState(0);
  return (
    <LocalSurvivalRun
      key={runId}
      definition={definition}
      onReplay={() => setRunId((current) => current + 1)}
    />
  );
}

function LocalSurvivalRun({
  definition,
  onReplay,
}: {
  readonly definition: LocalSurvivalDefinition;
  readonly onReplay: () => void;
}) {
  const [provider] = useState(() => createLocalSurvivalSessionProvider({ definition }));
  const session = useSurvivalGameSession({
    challenge: definition.challenge,
    provider,
    initialSession: NEW_SESSION,
  });
  return (
    <SurvivalGameView
      challenge={definition.challenge}
      session={session}
      returnTo="/demo/flash-pop"
      returnLabel="Volver al lobby"
      onReplay={onReplay}
    />
  );
}
