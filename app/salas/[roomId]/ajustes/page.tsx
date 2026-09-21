import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FlashPopRoomSettings } from "@/components/game";
import { getRoomSettingsPageModel } from "@/server/data-access";

type Props = {
  params: Promise<{ roomId: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { roomId } = await params;
  const room = await getRoomSettingsPageModel(roomId);

  return {
    title: room ? `Ajustes de ${room.title} — The Flash` : "Ajustes — The Flash",
  };
}

export default async function RoomSettingsPage({ params }: Props) {
  const { roomId } = await params;
  const room = await getRoomSettingsPageModel(roomId);

  if (!room) {
    notFound();
  }

  return <FlashPopRoomSettings model={room} />;
}
