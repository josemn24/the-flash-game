import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RoomChallengeClient } from "@/components/game/RoomChallengeClient.client";
import { challenges, getChallengeById } from "@/data/challenges";
import { getRoomById } from "@/lib/roomDetail";

type Props = {
  params: Promise<{ challengeId: string }>;
  searchParams: Promise<{ roomId?: string | string[] }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return challenges.map((challenge) => ({ challengeId: challenge.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const challenge = getChallengeById((await params).challengeId);
  return challenge
    ? { title: `${challenge.title} — The Flash`, description: challenge.description }
    : { title: "Desafío no encontrado — The Flash" };
}

export default async function ChallengePage({ params, searchParams }: Props) {
  const { challengeId } = await params;
  const challenge = getChallengeById(challengeId);
  if (!challenge) notFound();

  const roomIdValue = (await searchParams).roomId;
  const roomId = Array.isArray(roomIdValue) ? roomIdValue[0] : roomIdValue;
  const room = roomId ? getRoomById(roomId) : undefined;
  if (roomId && !room) notFound();

  return (
    <RoomChallengeClient
      challenge={challenge}
      roomContext={
        room
          ? {
              roomId: room.id,
              roomTitle: room.title,
              returnTo: `/salas/${room.id}`,
            }
          : undefined
      }
    />
  );
}
