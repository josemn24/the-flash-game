import { BackLink, Canvas } from "@/components/ui";
import type { RoomRankingModel } from "@/types/view-models";
import { RoomLeaderboard } from "./RoomLeaderboard";
import styles from "./FlashPopRoomSecondary.module.css";

export function FlashPopRoomRanking({
  roomId,
  roomTitle,
  season,
  currentUserId,
  entries,
}: RoomRankingModel) {
  const isFinished = season?.status === "finished";
  return (
    <Canvas contentClassName={styles.content}>
      <header className={styles.historyDetailToolbar}>
        <BackLink
          href={`/salas/${roomId}`}
          label="Volver al detalle de la sala"
          className={styles.historyDetailBack}
        />
        <p className={styles.historyDetailContext}>{roomTitle}</p>
      </header>

      <div className={styles.seasonRanking}>
        <RoomLeaderboard
          title={isFinished ? "Clasificación final" : "Ranking de temporada"}
          description={
            season ? `${season.title} · ${isFinished ? "Finalizada" : "En curso"}` : undefined
          }
          emptyMessage={
            season
              ? "Esta temporada no tiene resultados."
              : "Todavía no hay una temporada disponible."
          }
          entries={entries}
          currentUserId={currentUserId}
          bare
          headingLevel="h1"
        />
      </div>
    </Canvas>
  );
}
