import type { Room, RoomSettingsModel } from "@/types/game";

export function buildRoomSettingsModel(room: Room): RoomSettingsModel {
  return {
    roomId: room.id,
    title: room.title,
    currentUserId: room.currentUserId,
    memberCount: room.members.length,
    members: room.members.map(({ id, name, initials, avatarSrc, totalFlashPoints }) => ({
      id,
      name,
      initials,
      avatarSrc,
      totalFlashPoints,
      isCurrentUser: id === room.currentUserId,
    })),
  };
}
