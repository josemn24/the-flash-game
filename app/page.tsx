import { SpeedBackground } from "@/components/SpeedBackground";
import { StartScreen } from "@/components/StartScreen";
import { stages } from "@/data/stages";

export default function Home() {
  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-[var(--ink)] text-white selection:bg-[var(--electric)] selection:text-black">
      <SpeedBackground />
      <div className="relative z-10">
        <StartScreen stages={stages} />
      </div>
    </main>
  );
}
