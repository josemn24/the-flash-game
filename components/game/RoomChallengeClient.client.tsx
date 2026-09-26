"use client";

import { useCallback, useState } from "react";
import { GameApp } from "@/components/game/shells/GameApp";
import { CompetitiveResultScreen } from "@/components/game/shared";
import { ArrowIcon, ButtonLink, Canvas, Card, TrophyIcon } from "@/components/ui";
import { useRoomSession } from "@/features/rooms/RoomSessionProvider.client";
import { isTerminalCompetitiveAttemptStatus } from "@/features/rooms/competitiveAttempt";
import type { Challenge, ChallengeCompletionResult, GameRoomContext } from "@/types/game";
import type {
  ServerAlphabetChallenge,
  ServerFlashChallenge,
  ServerFlashTerminalReview,
  ServerSurvivalChallenge,
  ServerPyramidChallenge,
} from "@/types/gameplay/challenge";
import type { FlashPopSocialSnapshot, GameplayPersistence } from "@/types/view-models";

function TerminalCompetitiveChallenge({
  roomContext,
  status,
}: {
  roomContext: GameRoomContext;
  status: "completed" | "notCompleted";
}) {
  const resultHref = `/salas/${roomContext.roomId}/ranking/${roomContext.memberId}`;
  const title = status === "completed" ? "Desafío completado" : "Intento no completado";
  const description =
    status === "completed"
      ? "Este desafío ya cuenta para tu temporada. Puedes consultar el resultado y las posiciones, pero no repetir el intento competitivo."
      : "El intento competitivo ya está consumido. Puedes consultar la sala y sus posiciones, pero no iniciar otro intento.";

  return (
    <Canvas maxWidth="content">
      <Card as="section" aria-labelledby="terminal-challenge-title" className="mx-auto mt-12">
        <TrophyIcon className="mb-4 h-8 w-8 text-[var(--color-brand)]" />
        <h1 id="terminal-challenge-title">{title}</h1>
        <p className="mt-3 text-[var(--color-ink-muted)]">{description}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink href={roomContext.returnTo} variant="secondary" trailingIcon={<ArrowIcon />}>
            Volver a la sala
          </ButtonLink>
          <ButtonLink href={`${roomContext.returnTo}/ranking`} trailingIcon={<ArrowIcon />}>
            Ver ranking
          </ButtonLink>
          {status === "completed" ? (
            <ButtonLink href={resultHref} variant="secondary" trailingIcon={<ArrowIcon />}>
              Ver resultado
            </ButtonLink>
          ) : null}
        </div>
      </Card>
    </Canvas>
  );
}

function UnavailableCompetitiveChallenge({ roomContext }: { roomContext: GameRoomContext }) {
  const isExpired = roomContext.availabilityStatus === "expired";

  return (
    <Canvas maxWidth="content">
      <Card as="section" aria-labelledby="unavailable-challenge-title" className="mx-auto mt-12">
        <h1 id="unavailable-challenge-title">
          {isExpired ? "Desafío cerrado" : "Desafío no disponible"}
        </h1>
        <p className="mt-3 text-[var(--color-ink-muted)]">
          {isExpired
            ? "La publicación terminó antes de que iniciaras este desafío. No se creó ningún intento competitivo."
            : "Este desafío todavía no está disponible para jugar en la sala."}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink href={roomContext.returnTo} variant="secondary" trailingIcon={<ArrowIcon />}>
            Volver a la sala
          </ButtonLink>
          {isExpired ? (
            <ButtonLink href={`${roomContext.returnTo}/ranking`} trailingIcon={<ArrowIcon />}>
              Ver ranking
            </ButtonLink>
          ) : null}
        </div>
      </Card>
    </Canvas>
  );
}

export function RoomChallengeClient({
  challenge,
  roomContext,
  socialSnapshot,
  persistence: persistenceProp,
  terminalReview,
}: {
  challenge:
    | Challenge
    | ServerFlashChallenge
    | ServerAlphabetChallenge
    | ServerSurvivalChallenge
    | ServerPyramidChallenge;
  roomContext?: GameRoomContext;
  socialSnapshot: FlashPopSocialSnapshot;
  persistence?: GameplayPersistence;
  terminalReview?: readonly ServerFlashTerminalReview[];
}) {
  const persistence = persistenceProp ?? roomContext?.gameplayPersistence ?? "mock";
  const { recordCompletion, getCompletion } = useRoomSession();
  // Server-backed competitive sessions must never be shadowed by the
  // client-only demo store. The provider remains available for explicit
  // practice/preview routes, but it is not part of the pilot data path.
  const localCompletion =
    persistence === "mock" && roomContext
      ? getCompletion(roomContext.roomId, challenge.id)
      : undefined;
  const attemptStatus = localCompletion
    ? localCompletion.completed
      ? "completed"
      : "notCompleted"
    : roomContext?.attemptStatus;
  const [hasActiveGame] = useState(
    () =>
      !roomContext ||
      (!localCompletion && !isTerminalCompetitiveAttemptStatus(roomContext.attemptStatus)),
  );
  const onComplete = useCallback(
    (result: ChallengeCompletionResult) => {
      if (!roomContext || persistence !== "mock") return;
      recordCompletion({ ...result, roomId: roomContext.roomId });
    },
    [persistence, recordCompletion, roomContext],
  );

  if (
    persistence === "server" &&
    roomContext &&
    (!attemptStatus || !isTerminalCompetitiveAttemptStatus(attemptStatus))
  ) {
    return (
      <GameApp
        challenge={challenge}
        roomContext={roomContext}
        socialSnapshot={socialSnapshot}
        persistence="server"
      />
    );
  }

  if (
    roomContext &&
    !localCompletion &&
    attemptStatus === "available" &&
    roomContext.availabilityStatus !== "available"
  ) {
    return <UnavailableCompetitiveChallenge roomContext={roomContext} />;
  }

  if (
    persistence === "server" &&
    roomContext &&
    ("slots" in challenge || "entries" in challenge || "levels" in challenge) &&
    attemptStatus === "completed" &&
    roomContext.result
  ) {
    return (
      <GameApp
        challenge={challenge}
        roomContext={roomContext}
        socialSnapshot={socialSnapshot}
        persistence="server"
        terminalReview={terminalReview}
      />
    );
  }

  if (
    roomContext &&
    attemptStatus &&
    isTerminalCompetitiveAttemptStatus(attemptStatus) &&
    (!hasActiveGame || (persistence === "server" && attemptStatus === "notCompleted"))
  ) {
    const result = localCompletion ?? roomContext.result;
    if (attemptStatus === "completed" && result) {
      return (
        <CompetitiveResultScreen
          challenge={challenge as Challenge}
          result={result}
          returnTo={roomContext.returnTo}
        />
      );
    }
    return <TerminalCompetitiveChallenge roomContext={roomContext} status={attemptStatus} />;
  }

  return (
    <GameApp
      challenge={challenge as Challenge}
      roomContext={roomContext}
      socialSnapshot={socialSnapshot}
      persistence={persistence}
      onComplete={roomContext ? onComplete : undefined}
    />
  );
}
