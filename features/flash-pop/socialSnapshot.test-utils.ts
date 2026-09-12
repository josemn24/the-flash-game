import type { FlashPopSocialSnapshot } from "@/types/view-models";

const currentPlayer = {
  id: "player",
  displayName: "Kike",
  initials: "KI",
  tone: "social" as const,
};

const peerPlayers = [
  { id: "ches", displayName: "Dark", initials: "DA", tone: "ink" as const },
  { id: "marta", displayName: "Jackobo", initials: "JA", tone: "coral" as const },
  { id: "alex", displayName: "Rielbe", initials: "RI", tone: "blue" as const },
  { id: "laura", displayName: "Palmera", initials: "PA", tone: "aqua" as const },
] as const;

export function makeSocialSnapshot(peerCount = 3): FlashPopSocialSnapshot {
  const selectedPlayers = peerPlayers.slice(0, peerCount);
  return {
    currentPlayer,
    players: [currentPlayer, ...selectedPlayers],
    peers: selectedPlayers.map((player, index) => ({
      player,
      score: 80 - index * 20,
      timeUsed: 90 + index * 10,
      correctAnswers: 8 - index,
      lastCorrectAt: 80 + index * 10,
      completedAt: `2026-09-0${index + 1}T12:00:00.000Z`,
    })),
  };
}
