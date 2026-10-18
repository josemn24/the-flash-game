"use client";

import { useState } from "react";
import { FlashPopTimeTrialGameView } from "@/components/game/modes/flash-pop/ServerFlashPopTimeTrialGame.client";
import { createLocalTimeTrialSessionProvider } from "@/features/game/session/providers/localTimeTrial";
import { useTimeTrialGameSession } from "@/features/game/useServerTimeTrialSession";
import type { GameSessionBootstrap } from "@/types/gameplay/authoritative-session";
import type { LocalTimeTrialDefinition } from "@/types/gameplay/local-time-trial";

const NEW_SESSION: GameSessionBootstrap = { status: "new", results: [], score: 0 };

/** Fixture solutions stay inside the local authority; the competitive view is shared as-is. */
export function LocalTimeTrialGameApp({ definition }: { definition: LocalTimeTrialDefinition }) {
  const [runId, setRunId] = useState(0);
  return (
    <LocalTimeTrialRun
      key={runId}
      definition={definition}
      onReplay={() => setRunId((current) => current + 1)}
    />
  );
}

function LocalTimeTrialRun({
  definition,
  onReplay,
}: {
  readonly definition: LocalTimeTrialDefinition;
  readonly onReplay: () => void;
}) {
  const [provider] = useState(() => createLocalTimeTrialSessionProvider({ definition }));
  const session = useTimeTrialGameSession({
    challenge: definition.challenge,
    provider,
    initialSession: NEW_SESSION,
  });
  return (
    <FlashPopTimeTrialGameView
      challenge={definition.challenge}
      returnTo="/demo/flash-pop"
      session={session}
      onReplay={onReplay}
    />
  );
}
