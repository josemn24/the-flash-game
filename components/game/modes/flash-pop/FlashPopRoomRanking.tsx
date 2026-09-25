import Link from "next/link";
import { ArrowIcon, Canvas } from "@/components/ui";
import type { RoomLeaderboardEntry } from "@/types/game";
import { RoomLeaderboard } from "./RoomLeaderboard";
import styles from "./FlashPopRoomSecondary.module.css";

export function FlashPopRoomRanking({
  roomId,
  roomTitle,
  currentUserId,
  entries,
}: {
  roomId: string;
  roomTitle: string;
  currentUserId: string;
  entries: RoomLeaderboardEntry[];
}) {
  return (
    <Canvas contentClassName={styles.content}>
      <header className={styles.toolbar}>
        <Link
          href={`/salas/${roomId}`}
          className={styles.backLink}
          aria-label="Volver al detalle de la sala"
        >
          <ArrowIcon className={styles.backIcon} />
        </Link>
      </header>

      <RoomLeaderboard
        title="Ranking global"
        entries={entries}
        currentUserId={currentUserId}
        bare
        headingLevel="h1"
      />
    </Canvas>
  );
}
