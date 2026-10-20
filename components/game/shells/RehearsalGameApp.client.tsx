"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { GameSessionProvider } from "@/application/ports/game-session";
import type { RehearsalDefinition, RehearsalRef } from "@/types/gameplay/rehearsal";
import { createLocalFlashSessionProvider } from "@/features/game/session/providers/localFlash";
import { createLocalSurvivalSessionProvider } from "@/features/game/session/providers/localSurvival";
import { createLocalPyramidSessionProvider } from "@/features/game/session/providers/localPyramid";
import { createLocalAlphabetSessionProvider } from "@/features/game/session/providers/localAlphabet";
import { createLocalTimeTrialSessionProvider } from "@/features/game/session/providers/localTimeTrial";
import { useFlashGameSession } from "@/features/game/useFlashGameSession";
import { useSurvivalGameSession } from "@/features/game/useSurvivalGameSession";
import { usePyramidGameSession } from "@/features/game/usePyramidGameSession";
import { useAlphabetGameSession } from "@/features/game/useServerAlphabetSession";
import { useTimeTrialGameSession } from "@/features/game/useServerTimeTrialSession";
import { loadMiniWordleDictionary } from "@/lib/miniWordleDictionary";
import { FlashGameView } from "../modes/flash-pop/FlashGameView";
import { SurvivalGameView } from "../modes/flash-pop/SurvivalGameView";
import { PyramidGameView } from "../modes/flash-pop/PyramidGameView";
import { AlphabetGameView } from "../modes/flash-pop/ServerFlashPopAlphabetGame.client";
import { FlashPopTimeTrialGameView } from "../modes/flash-pop/ServerFlashPopTimeTrialGame.client";
import { RehearsalPresentation } from "../shared/RehearsalPresentation";
import { BackButton, Button, Canvas, Card } from "@/components/ui";

const NEW_SESSION = { status: "new" as const, results: [], score: 0 };
type Definition<M extends RehearsalDefinition["challenge"]["mode"]> = Extract<
  RehearsalDefinition,
  { challenge: { mode: M } }
>;
type RunProps = {
  definition: RehearsalDefinition;
  provider: GameSessionProvider;
  returnTo: string;
};

export function RehearsalGameApp(props: {
  definition: RehearsalDefinition;
  reference: RehearsalRef;
  returnTo: string;
}) {
  return (
    <RehearsalPresentation.Provider value={{ returnTo: props.returnTo }}>
      <PreparedRun
        key={`${props.returnTo}:${props.reference.id}:${props.reference.version}:${props.reference.contentHash}`}
        {...props}
      />
    </RehearsalPresentation.Provider>
  );
}

function imageSources(value: unknown, found = new Set<string>()): Set<string> {
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (key === "src" && typeof child === "string") found.add(child);
      else imageSources(child, found);
    }
  }
  return found;
}
function PreparedRun({
  definition: incoming,
  returnTo,
}: {
  definition: RehearsalDefinition;
  returnTo: string;
}) {
  const [definition] = useState(() => structuredClone(incoming));
  const [attempt, setAttempt] = useState(0);
  const [prepared, setPrepared] = useState<{
    dictionaries: ReadonlyMap<string, ReadonlySet<string>>;
  } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let current = true;
    const images: HTMLImageElement[] = [];
    const required = new Map<string, 4 | 5>();
    for (const level of definition.levels) {
      if (level.publicQuestion.type === "mini-wordle" && level.solution.type === "mini-wordle")
        required.set(level.solution.payload.dictionaryId, level.publicQuestion.payload.wordLength);
    }
    const media = [...imageSources(definition.levels.map((l) => l.publicQuestion))].map(
      (src) =>
        new Promise<void>((resolve, reject) => {
          const image = new Image();
          images.push(image);
          image.onload = () => resolve();
          image.onerror = () => reject(new Error("rehearsal_asset_unavailable"));
          image.src = src;
        }),
    );
    void Promise.all([
      Promise.all(
        [...required].map(
          async ([id, length]) => [id, await loadMiniWordleDictionary(length)] as const,
        ),
      ),
      ...media,
    ]).then(
      ([entries]) => {
        if (current) setPrepared({ dictionaries: new Map(entries) });
      },
      () => {
        if (current) {
          console.warn(
            JSON.stringify({ event: "rehearsal_resource_failed", code: "preparation_failed" }),
          );
          setFailed(true);
        }
      },
    );
    return () => {
      current = false;
      images.forEach((image) => {
        image.onload = null;
        image.onerror = null;
        image.src = "";
      });
    };
  }, [definition, attempt]);
  if (!prepared)
    return (
      <RehearsalPreparation
        returnTo={returnTo}
        error={failed ? "No se pudieron preparar los recursos de la prueba." : undefined}
        onRetry={() => {
          setFailed(false);
          setAttempt((n) => n + 1);
        }}
      />
    );
  return (
    <LocalRun definition={definition} dictionaries={prepared.dictionaries} returnTo={returnTo} />
  );
}

function RehearsalPreparation({
  returnTo,
  error,
  onRetry,
}: {
  returnTo: string;
  error?: string;
  onRetry: () => void;
}) {
  return (
    <Canvas maxWidth="content">
      <Card>
        <BackButton label="Volver al desafío" onClick={() => window.location.assign(returnTo)} />
        <h1>Partida de prueba</h1>
        {error ? (
          <>
            <p role="alert">{error}</p>
            <Button onClick={onRetry}>Reintentar</Button>
          </>
        ) : (
          <p role="status">Preparando la prueba…</p>
        )}
      </Card>
    </Canvas>
  );
}

function AutoStartRun({
  session,
  returnTo,
  children,
}: {
  session: Pick<
    ReturnType<typeof usePyramidGameSession>,
    "phase" | "begin" | "lifecycleError" | "retryLifecycle"
  >;
  returnTo: string;
  children: ReactNode;
}) {
  const started = useRef(false);
  const { begin } = session;
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void begin();
  }, [begin]);

  if (session.phase === "intro")
    return (
      <RehearsalPreparation
        returnTo={returnTo}
        error={session.lifecycleError ? "No se pudo iniciar la prueba." : undefined}
        onRetry={session.retryLifecycle}
      />
    );
  return children;
}
function LocalRun({
  definition,
  dictionaries,
  returnTo,
}: {
  definition: RehearsalDefinition;
  dictionaries: ReadonlyMap<string, ReadonlySet<string>>;
  returnTo: string;
}) {
  const [provider] = useState(() => {
    switch (definition.challenge.mode) {
      case "flash":
        return createLocalFlashSessionProvider({
          definition: definition as Definition<"flash">,
          dictionaries,
        });
      case "survival":
        return createLocalSurvivalSessionProvider({
          definition: definition as Definition<"survival">,
          dictionaries,
        });
      case "pyramid":
        return createLocalPyramidSessionProvider({
          definition: definition as Definition<"pyramid">,
          dictionaries,
        });
      case "alphabet":
        return createLocalAlphabetSessionProvider({
          definition: definition as Definition<"alphabet">,
        });
      case "time-trial":
        return createLocalTimeTrialSessionProvider({
          definition: definition as Definition<"time-trial">,
        });
    }
  });
  const props = { definition, provider, returnTo };
  switch (definition.challenge.mode) {
    case "flash":
      return <FlashRun {...props} />;
    case "survival":
      return <SurvivalRun {...props} />;
    case "pyramid":
      return <PyramidRun {...props} />;
    case "alphabet":
      return <AlphabetRun {...props} />;
    case "time-trial":
      return <TimeTrialRun {...props} />;
  }
}
function FlashRun({ definition, provider, returnTo }: RunProps) {
  const challenge = (definition as Definition<"flash">).challenge;
  const session = useFlashGameSession({ challenge, provider, initialSession: NEW_SESSION });
  return (
    <AutoStartRun session={session} returnTo={returnTo}>
      <FlashGameView
        challenge={challenge}
        session={session}
        returnTo={returnTo}
        prefetchReturnTo={false}
      />
    </AutoStartRun>
  );
}
function SurvivalRun({ definition, provider, returnTo }: RunProps) {
  const challenge = (definition as Definition<"survival">).challenge;
  const session = useSurvivalGameSession({ challenge, provider, initialSession: NEW_SESSION });
  return (
    <AutoStartRun session={session} returnTo={returnTo}>
      <SurvivalGameView
        challenge={challenge}
        session={session}
        returnTo={returnTo}
        returnLabel="Volver al desafío"
      />
    </AutoStartRun>
  );
}
function PyramidRun({ definition, provider, returnTo }: RunProps) {
  const challenge = (definition as Definition<"pyramid">).challenge;
  const session = usePyramidGameSession({ challenge, provider, initialSession: NEW_SESSION });
  return (
    <AutoStartRun session={session} returnTo={returnTo}>
      <PyramidGameView
        challenge={challenge}
        session={session}
        returnTo={returnTo}
        prefetchReturnTo={false}
      />
    </AutoStartRun>
  );
}
function AlphabetRun({ definition, provider, returnTo }: RunProps) {
  const challenge = (definition as Definition<"alphabet">).challenge;
  const session = useAlphabetGameSession({ challenge, provider, initialSession: NEW_SESSION });
  return (
    <AutoStartRun session={session} returnTo={returnTo}>
      <AlphabetGameView challenge={challenge} session={session} returnTo={returnTo} />
    </AutoStartRun>
  );
}
function TimeTrialRun({ definition, provider, returnTo }: RunProps) {
  const challenge = (definition as Definition<"time-trial">).challenge;
  const session = useTimeTrialGameSession({ challenge, provider, initialSession: NEW_SESSION });
  return (
    <AutoStartRun session={session} returnTo={returnTo}>
      <FlashPopTimeTrialGameView challenge={challenge} session={session} returnTo={returnTo} />
    </AutoStartRun>
  );
}
