import Link from "next/link";
import { ArrowIcon, Avatar, Canvas } from "@/components/ui";
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
        <Link href={`/salas/${roomId}`} className={styles.backLink} aria-label="Volver al detalle de la sala">
          <ArrowIcon className={styles.backIcon} />
        </Link>
        <div className={styles.roomIdentity}>
          <Avatar name={roomTitle} initials={roomTitle.slice(0, 2).toUpperCase()} tone="social" size="md" />
          <span>{roomTitle}</span>
        </div>
      </header>

      <div className={styles.pageIntro}>
        <p className={styles.eyebrow}>TABARNIA</p>
        <h1>Ranking global</h1>
      </div>

      <RoomLeaderboard
        title="Clasificación de la sala"
        entries={entries}
        currentUserId={currentUserId}
      />
    </Canvas>
  );
}
