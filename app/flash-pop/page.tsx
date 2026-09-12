import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FlashPopLobby } from "@/components/game";
import { getFlashPopLobbyPageModel } from "@/server/data-access";

export const metadata: Metadata = {
  title: "Flash Pop — Lobby",
  description: "Lobby demo de Flash Pop: asciende por siete niveles de La Pirámide.",
};

export const dynamic = "force-dynamic";

export default async function FlashPopPage() {
  const model = await getFlashPopLobbyPageModel();
  if (model.primary.challenge.mode !== "pyramid" || model.secondary.challenge.mode !== "pyramid")
    notFound();
  return <FlashPopLobby model={model} />;
}
