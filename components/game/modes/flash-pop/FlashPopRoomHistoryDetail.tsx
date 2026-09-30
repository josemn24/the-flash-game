import { BackLink, Card, Canvas, Chip } from "@/components/ui";
import type { RoomDailyLeaderboardEntry, RoomHistoryEntry } from "@/types/compat/game";
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
  canReviewMembers = false,
}: {
  roomId: string;
  roomTitle: string;
  entry: RoomHistoryEntry;
  ranking: RoomDailyLeaderboardEntry[];
  currentUserId: string;
  canReviewMembers?: boolean;
}) {
  return (
    <Canvas contentClassName={styles.content}>
      <header className={styles.toolbar}>
        <BackLink href={`/salas/${roomId}/historial`} label="Volver al historial de la sala" />
      </header>

      <div className={styles.pageIntro}>
        <p className={styles.eyebrow}>{roomTitle.toUpperCase()}</p>
        <p className={styles.historyMeta}>
          {entry.formatLabel} · {entry.subtitle}
        </p>
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
            memberHrefBase={
              canReviewMembers ? `/salas/${roomId}/historial/${entry.challengeId}` : undefined
            }
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
