import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChallengeIntro } from "@/components/game/shared/ChallengeIntro";
import { getRoomIntroductionPageModel } from "@/server/data-access";

type Props = {
  params: Promise<{ roomId: string; challengeId: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { roomId, challengeId } = await params;
  const introduction = await getRoomIntroductionPageModel(roomId, challengeId);

  return introduction
    ? {
        title: `${introduction.challengeTitle} — Flash Pop`,
        description: `Introducción autorizada del desafío de ${introduction.roomTitle}.`,
      }
    : { title: "Desafío no disponible — Flash Pop" };
}

export default async function RoomIntroductionPage({ params }: Props) {
  const { roomId, challengeId } = await params;
  const model = await getRoomIntroductionPageModel(roomId, challengeId);
  if (!model) notFound();

  const note = model.availabilityStatus === "upcoming"
    ? "La partida estará disponible cuando se abra su ventana."
    : model.availabilityStatus === "closed"
      ? "La ventana competitiva ya está cerrada."
      : model.availabilityStatus === "cancelled"
        ? "Esta publicación fue cancelada y no admite nuevas partidas."
        : !model.canStart
          ? "Puedes consultar la introducción, pero no iniciar una partida competitiva."
          : model.competitivePlayable
            ? ""
            : "El contenido no está disponible para competición.";

  return (
    <ChallengeIntro
      introduction={{
        title: model.challengeTitle,
        mode: model.mode,
        questionCount: model.questionCount,
        maxScore: model.maxScore,
      }}
      canStart={model.canStart && model.availabilityStatus === "available" && model.competitivePlayable}
      startHref={
        model.competitivePlayable
          ? `/desafios/${model.publicationId}?roomId=${model.roomId}`
          : undefined
      }
      note={note}
      returnTo={`/salas/${model.roomId}`}
    />
  );
}
