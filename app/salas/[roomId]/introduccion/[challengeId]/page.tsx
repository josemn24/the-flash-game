import type { Metadata } from "next";
import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ roomId: string; challengeId: string }>;
};

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Desafío — The Flash" };

export default async function RoomIntroductionPage({ params }: Props) {
  const { roomId, challengeId } = await params;
  redirect(`/desafios/${encodeURIComponent(challengeId)}?roomId=${encodeURIComponent(roomId)}`);
}
