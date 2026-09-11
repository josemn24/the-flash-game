import type { RoomHistoryEntry } from "@/types/game";

export const demoRoomHistory: Record<string, RoomHistoryEntry[]> = {
  "tabarnia-room": [
    {
      id: "tabarnia-history-05",
      challengeId: "tabarnia-challenge-05",
      title: "La Pirámide: Cumbre lógica",
      playedAt: "2026-09-05T20:30:00.000Z",
      imageSrc: "/flash-pop/concepts/pyramid-soft-diorama.webp",
      playerCount: 4,
      winnerMemberId: "ches",
    },
    {
      id: "tabarnia-history-04",
      challengeId: "tabarnia-challenge-04",
      title: "P-17: Señales en la nieve",
      playedAt: "2026-09-04T19:10:00.000Z",
      imageSrc: "/flash-pop/concepts/narrative-story-trail.webp",
      playerCount: 5,
      winnerMemberId: "marta",
    },
    {
      id: "tabarnia-history-03",
      challengeId: "tabarnia-challenge-03",
      title: "Supervivencia: España",
      playedAt: "2026-09-03T21:45:00.000Z",
      imageSrc: "/flash-pop/concepts/survival-last-beacon.webp",
      playerCount: 5,
      winnerMemberId: "ches",
    },
  ],
};

export function getRoomHistory(roomId: string) {
  return demoRoomHistory[roomId] ?? [];
}
