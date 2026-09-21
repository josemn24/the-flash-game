import Link from "next/link";
import { ArrowIcon, Card, Canvas, Chip } from "@/components/ui";
import type { RoomDailyLeaderboardEntry, RoomHistoryEntry } from "@/types/game";
import { RoomLeaderboard } from "./RoomLeaderboard";
import styles from "./FlashPopRoomSecondary.module.css";

function formatHistoryDate(value: string) {
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    timeZone: "Europe/Madrid",
  }).format(new Date(value));
}

export function FlashPopRoomHistoryDetail({
  roomId,
  roomTitle,
  entry,
  ranking,
  currentUserId,
}: {
  roomId: string;
  roomTitle: string;
  entry: RoomHistoryEntry;
  ranking: RoomDailyLeaderboardEntry[];
  currentUserId: string;
}) {
  return (
    <Canvas contentClassName={styles.content}>
      <header className={styles.toolbar}>
        <Link
          href={`/salas/${roomId}/historial`}
          className={styles.backLink}
          aria-label="Volver al historial de la sala"
        >
          <ArrowIcon className={styles.backIcon} />
        </Link>
      </header>

      <div className={styles.pageIntro}>
        <p className={styles.eyebrow}>{roomTitle.toUpperCase()}</p>
        <h1>{entry.title}</h1>
        <div className={styles.detailBadges}>
          <Chip variant="data">{formatHistoryDate(entry.playedAt)}</Chip>
          <Chip variant="data">{entry.playerCount} jugadores</Chip>
        </div>
      </div>

      <section className={styles.detailRanking} aria-label="Ranking del desafío">
        {ranking.length > 0 ? (
          <RoomLeaderboard
            title="Ranking del desafío"
            entries={ranking}
            currentUserId={currentUserId}
            daily
            bare
            headingLevel="h2"
          />
        ) : (
          <Card as="section" surface="soft" className={styles.emptyState}>
            <h2 id="history-ranking-title">No hay resultados disponibles.</h2>
          </Card>
        )}
      </section>
    </Canvas>
  );
}
