import { demoSeasonScheduledChallenges } from "@/data/scheduledChallenges";
import type { Room } from "@/types/game";

export const demoRoom = {
  id: "tabarnia-room",
  title: "Tabarnia",
  description: "Sala privada mock para la primera temporada de The Flash.",
  activeSeason: {
    id: "tabarnia-season-1",
    title: "Primera temporada",
    status: "active",
    scheduledChallenges: demoSeasonScheduledChallenges,
  },
} satisfies Room;
