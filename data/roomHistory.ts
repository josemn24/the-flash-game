import { roomRouteAliases } from "@/data/mock/constants";
import { toLegacyRoomHistory } from "@/data/mock/legacyAdapters";
import type { RoomHistoryEntry } from "@/types/game";

/** @deprecated Proyección derivada; usa `selectRoomHistory`. */
export const demoRoomHistory: Record<string, RoomHistoryEntry[]> = {
  "tabarnia-room": toLegacyRoomHistory(roomRouteAliases["tabarnia-room"]),
};

export function getRoomHistory(roomId: string) {
  return demoRoomHistory[roomId] ?? [];
}

export function getRoomHistoryEntry(roomId: string, challengeId: string) {
  return getRoomHistory(roomId).find((entry) => entry.challengeId === challengeId);
}
