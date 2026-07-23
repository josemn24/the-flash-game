import { connectionsChallenge } from "@/data/connectionsChallenge";
import { demoChallenge } from "@/data/demoChallenge";
import type { Room } from "@/types/game";

export const demoRoom = {
  id: "demo-room",
  title: "Sala Demo",
  description: "Sala local para probar desafíos de The Flash.",
  activeSeason: {
    id: "demo-season",
    title: "Temporada Demo",
    status: "active",
    challenges: [demoChallenge, connectionsChallenge],
  },
} satisfies Room;
