import { SpeedBackground } from "@/components/SpeedBackground";
import { StartScreen } from "@/components/StartScreen";
import { stages } from "@/data/stages";
import type { StageSummary } from "@/types/game";

export default function Home() {
  const stageSummaries: StageSummary[] = stages.map((stage) => ({
    id: stage.id,
    number: stage.number,
    title: stage.title,
    subtitle: stage.subtitle,
    questionCount: stage.questions.length,
  }));

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-[var(--ink)] text-white selection:bg-[var(--electric)] selection:text-black">
      <SpeedBackground />
      <div className="relative z-10">
        <StartScreen stages={stageSummaries} />
      </div>
    </main>
  );
}
