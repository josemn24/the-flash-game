import { FlashPopHome } from "@/components/game";
import { demoRooms } from "@/data/demoRoom";
import { buildRoomCardModel } from "@/lib/roomCard";

export const dynamic = "force-dynamic";

export default function Home() {
  const rooms = demoRooms.map((room) => buildRoomCardModel(room));

  return <FlashPopHome rooms={rooms} />;
}
