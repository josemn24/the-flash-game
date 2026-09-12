import { FlashPopHome } from "@/components/game";
import { demoRoom, demoRooms } from "@/data/demoRoom";
import { buildRoomCardModel } from "@/lib/roomCard";

export const dynamic = "force-dynamic";

export default function Home() {
  const rooms = demoRooms.map((room) => buildRoomCardModel(room));
  const currentUser = demoRoom.members.find((member) => member.id === demoRoom.currentUserId);

  if (!currentUser) {
    throw new Error("The demo room must have a current user.");
  }

  return (
    <FlashPopHome
      rooms={rooms}
      initialProfile={{
        id: currentUser.id,
        name: currentUser.name,
        avatarSrc: currentUser.avatarSrc,
      }}
    />
  );
}
