"use client";

import { ChallengeIntro } from "@/components/game/shared/ChallengeIntro";
import type { RoomIntroductionModel } from "@/types/view-models";

function getAvailabilityNote(model: RoomIntroductionModel) {
  if (model.availabilityStatus === "upcoming") {
    return "La partida estará disponible cuando se abra su ventana.";
  }
  if (model.availabilityStatus === "closed") {
    return "La ventana competitiva ya está cerrada.";
  }
  if (model.availabilityStatus === "cancelled") {
    return "Esta publicación fue cancelada y no admite nuevas partidas.";
  }
  if (!model.canStart) {
    return "Puedes consultar la introducción, pero no iniciar una partida competitiva.";
  }
  return model.competitivePlayable ? "" : "El contenido no está disponible para competición.";
}

/**
 * Safe fallback for room challenges that are not playable yet or anymore.
 * The playable case is rendered by the gameplay controller so it can start
 * the authoritative attempt explicitly from its own button.
 */
export function RoomChallengeIntroduction({ model }: { model: RoomIntroductionModel }) {
  return (
    <ChallengeIntro
      introduction={{
        title: model.challengeTitle,
        mode: model.mode,
        questionCount: model.questionCount,
        maxScore: model.maxScore,
      }}
      canStart={false}
      note={getAvailabilityNote(model)}
      returnTo={`/salas/${model.roomId}`}
    />
  );
}
