import { demoSeasonScheduledChallenges } from "@/data/scheduledChallenges";
import type { Room } from "@/types/game";

export const demoRoom = {
  id: "demo-room",
  title: "Sala Demo",
  description: "Sala local para probar desafíos de The Flash.",
  activeSeason: {
    id: "demo-season",
    title: "Temporada Demo",
    status: "active",
    scheduledChallenges: demoSeasonScheduledChallenges,
  },
} satisfies Room;
