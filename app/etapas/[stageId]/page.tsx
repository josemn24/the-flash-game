import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GameApp } from "@/components/GameApp";
import { getStageById, stages } from "@/data/stages";

type Props = { params: Promise<{ stageId: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return stages.map((stage) => ({ stageId: stage.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const stage = getStageById((await params).stageId);
  return stage
    ? { title: `${stage.title} — The Flash`, description: stage.description }
    : { title: "Etapa no encontrada — The Flash" };
}

export default async function StagePage({ params }: Props) {
  const stage = getStageById((await params).stageId);
  if (!stage) notFound();
  return <GameApp stage={stage} />;
}
