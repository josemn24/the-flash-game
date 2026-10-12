import { BackLink, Card, Canvas } from "@/components/ui";
import type { RoomDailyLeaderboardEntry, RoomHistoryEntry } from "@/types/view-models/room";
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
      <header className={styles.historyDetailToolbar}>
        <BackLink
          href={`/salas/${roomId}/historial`}
          label="Volver al historial de la sala"
          className={styles.historyDetailBack}
        />
        <p className={styles.historyDetailContext}>
          <span>Historial</span>
          <span aria-hidden="true">·</span>
          <span>{roomTitle}</span>
        </p>
      </header>

      <div className={styles.historyDetailIntro}>
        <p className={styles.historyMeta}>{entry.formatLabel}</p>
        <h1>{entry.title}</h1>
        <p className={styles.historyDetailMeta}>
          <span>{formatHistoryDate(entry.playedAt)}</span>
          <span aria-hidden="true">·</span>
          <span>
            {entry.playerCount} {entry.playerCount === 1 ? "jugador" : "jugadores"}
          </span>
        </p>
      </div>

      <section className={styles.detailRanking} aria-label="Ranking del desafío">
        {ranking.length > 0 ? (
          <RoomLeaderboard
            title="Ranking"
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
