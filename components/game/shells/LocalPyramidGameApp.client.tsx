"use client";

import { useState } from "react";
import { createLocalPyramidSessionProvider } from "@/features/game/session/providers/localPyramid";
import { usePyramidGameSession } from "@/features/game/usePyramidGameSession";
import type { LocalPyramidDefinition } from "@/types/gameplay/local-pyramid";
import type { GameSessionBootstrap } from "@/types/gameplay/authoritative-session";
import { PyramidGameView } from "../modes/flash-pop/PyramidGameView";

const NEW_SESSION: GameSessionBootstrap = { status: "new", results: [], score: 0 };

/** Local-only composition. The private mock definition stops at this boundary. */
export function LocalPyramidGameApp({ definition }: { definition: LocalPyramidDefinition }) {
  const [runId, setRunId] = useState(0);
  return (
    <LocalPyramidRun
      key={runId}
      definition={definition}
      onReplay={() => setRunId((current) => current + 1)}
    />
  );
}

function LocalPyramidRun({
  definition,
  onReplay,
}: {
  definition: LocalPyramidDefinition;
  onReplay: () => void;
}) {
  const [provider] = useState(() => createLocalPyramidSessionProvider({ definition }));
  const session = usePyramidGameSession({
    challenge: definition.challenge,
    provider,
    initialSession: NEW_SESSION,
  });
  return (
    <PyramidGameView
      challenge={definition.challenge}
      session={session}
      returnTo="/demo/flash-pop"
      prefetchReturnTo={false}
      onReplay={onReplay}
    />
  );
}
