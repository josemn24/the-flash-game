"use client";

import { useState } from "react";
import { createLocalFlashSessionProvider } from "@/features/game/session/providers/localFlash";
import { useFlashGameSession } from "@/features/game/useFlashGameSession";
import type { LocalFlashDefinition } from "@/types/gameplay/local-pyramid";
import type { GameSessionBootstrap } from "@/types/gameplay/authoritative-session";
import { FlashGameView } from "../modes/flash-pop/FlashGameView";

const NEW_SESSION: GameSessionBootstrap = { status: "new", results: [], score: 0 };

/** Local-only composition. Private mock answers stop at this provider boundary. */
export function LocalFlashGameApp({ definition }: { definition: LocalFlashDefinition }) {
  const [runId, setRunId] = useState(0);
  return (
    <LocalFlashRun
      key={runId}
      definition={definition}
      onReplay={() => setRunId((current) => current + 1)}
    />
  );
}

function LocalFlashRun({
  definition,
  onReplay,
}: {
  readonly definition: LocalFlashDefinition;
  readonly onReplay: () => void;
}) {
  const [provider] = useState(() => createLocalFlashSessionProvider({ definition }));
  const session = useFlashGameSession({
    challenge: definition.challenge,
    provider,
    initialSession: NEW_SESSION,
  });
  return (
    <FlashGameView
      challenge={definition.challenge}
      session={session}
      returnTo="/demo/flash-pop"
      prefetchReturnTo={false}
      onReplay={onReplay}
    />
  );
}
