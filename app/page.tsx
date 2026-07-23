import { SpeedBackground } from "@/components/SpeedBackground";
import { StartScreen } from "@/components/StartScreen";
import { challenges } from "@/data/challenges";
import { demoRoom } from "@/data/demoRoom";
import type { ChallengeSummary } from "@/types/game";

export default function Home() {
  const activeSeason = demoRoom.activeSeason;
  const challengeSummaries: ChallengeSummary[] = challenges.map((challenge) => ({
    id: challenge.id,
    number: challenge.number,
    title: challenge.title,
    subtitle: challenge.subtitle,
    mode: challenge.mode,
    questionCount: challenge.questions.length,
  }));

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-[var(--ink)] text-white selection:bg-[var(--electric)] selection:text-black">
      <SpeedBackground />
      <div className="relative z-10">
        <StartScreen
          roomTitle={demoRoom.title}
          seasonTitle={activeSeason.title}
          seasonStatus={activeSeason.status}
          challenges={challengeSummaries}
        />
      </div>
    </main>
  );
}
