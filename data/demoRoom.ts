import { demoSeasonScheduledChallenges } from "@/data/scheduledChallenges";
import type { Room } from "@/types/game";

export const demoRoom = {
  id: "tabarnia-room",
  title: "Tabarnia",
  description: "Sala privada mock para la primera temporada de The Flash.",
  currentUserId: "player",
  members: [
    {
      id: "player",
      name: "Jugador",
      initials: "TÚ",
      totalPoints: 136,
      challengeResults: {
        "tabarnia-flash-01": { points: 42, completed: true },
        "tabarnia-challenge-02": { points: 31, completed: true },
        "tabarnia-challenge-03": { points: 27, completed: true },
        "tabarnia-challenge-04": { points: 36, completed: true },
        "tabarnia-challenge-05": { points: 0, completed: false },
        "tabarnia-challenge-06": { points: 0, completed: false },
      },
    },
    {
      id: "ches",
      name: "CHES",
      initials: "CH",
      totalPoints: 184,
      challengeResults: {
        "tabarnia-flash-01": { points: 54, completed: true },
        "tabarnia-challenge-02": { points: 44, completed: true },
        "tabarnia-challenge-03": { points: 32, completed: true },
        "tabarnia-challenge-04": { points: 54, completed: true },
        "tabarnia-challenge-05": { points: 0, completed: false },
        "tabarnia-challenge-06": { points: 0, completed: false },
      },
    },
    {
      id: "marta",
      name: "Marta",
      initials: "MA",
      totalPoints: 161,
      challengeResults: {
        "tabarnia-flash-01": { points: 47, completed: true },
        "tabarnia-challenge-02": { points: 39, completed: true },
        "tabarnia-challenge-03": { points: 35, completed: true },
        "tabarnia-challenge-04": { points: 40, completed: true },
        "tabarnia-challenge-05": { points: 0, completed: false },
        "tabarnia-challenge-06": { points: 0, completed: false },
      },
    },
    {
      id: "alex",
      name: "Alex",
      initials: "AL",
      totalPoints: 119,
      challengeResults: {
        "tabarnia-flash-01": { points: 38, completed: true },
        "tabarnia-challenge-02": { points: 28, completed: true },
        "tabarnia-challenge-03": { points: 29, completed: true },
        "tabarnia-challenge-04": { points: 24, completed: true },
        "tabarnia-challenge-05": { points: 0, completed: false },
        "tabarnia-challenge-06": { points: 0, completed: false },
      },
    },
    {
      id: "laura",
      name: "Laura",
      initials: "LA",
      totalPoints: 98,
      challengeResults: {
        "tabarnia-flash-01": { points: 0, completed: false },
        "tabarnia-challenge-02": { points: 36, completed: true },
        "tabarnia-challenge-03": { points: 31, completed: true },
        "tabarnia-challenge-04": { points: 31, completed: true },
        "tabarnia-challenge-05": { points: 0, completed: false },
        "tabarnia-challenge-06": { points: 0, completed: false },
      },
    },
  ],
  activeSeason: {
    id: "tabarnia-season-1",
    title: "Primera temporada",
    status: "active",
    scheduledChallenges: demoSeasonScheduledChallenges,
  },
} satisfies Room;

export const demoRooms: Room[] = [demoRoom];
