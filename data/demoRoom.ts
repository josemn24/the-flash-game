import { demoIdentity, roomRouteAliases } from "@/data/mock/constants";
import { toLegacyRoomSnapshot } from "@/data/mock/legacyAdapters";
import type { Room } from "@/types/game";

/** @deprecated Proyección del store normalizado para consumidores existentes. */
export const demoRoom = toLegacyRoomSnapshot(
  roomRouteAliases["tabarnia-room"],
  demoIdentity.currentPlayerId,
) as Room;

/** @deprecated Usa selectores de `@/data/mock`. */
export const demoRooms: Room[] = [demoRoom];
