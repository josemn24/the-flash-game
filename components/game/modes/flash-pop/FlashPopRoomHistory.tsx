import Image from "next/image";
import Link from "next/link";
import { ArrowIcon, Avatar, ButtonLink, Canvas, Card, Chip, ChevronIcon } from "@/components/ui";
import { ROOM_ART_FALLBACK } from "@/lib/roomCard";
import type { RoomDailyLeaderboardEntry, RoomHistoryEntry } from "@/types/game";
import styles from "./FlashPopRoomSecondary.module.css";

function formatHistoryDate(value: string) {
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    timeZone: "Europe/Madrid",
  }).format(new Date(value));
}

export function FlashPopRoomHistory({
  roomId,
  entries,
  rankings,
}: {
  roomId: string;
  entries: RoomHistoryEntry[];
  rankings: Record<string, RoomDailyLeaderboardEntry[]>;
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

      <div className={styles.pageIntro}>
        <p className={styles.eyebrow}>TABARNIA</p>
        <h1>Historial</h1>
      </div>

      {entries.length > 0 ? (
        <div className={styles.historyList}>
          {entries.map((entry) => {
            const winner = rankings[entry.challengeId]?.[0];

            return (
              <Card as="article" padding="none" key={entry.id} className={styles.historyEntry}>
                <div className={styles.historyArt}>
                  <Image
                    src={entry.imageSrc || ROOM_ART_FALLBACK}
                    alt={`Ilustración de ${entry.title}`}
                    fill
                    sizes="(max-width: 700px) 100vw, 760px"
                  />
                  <div className={styles.historyBadges}>
                    <Chip variant="data">{formatHistoryDate(entry.playedAt)}</Chip>
                    <Chip variant="data">{entry.playerCount} jugadores</Chip>
                  </div>
                </div>
                <div className={styles.historyBody}>
                  <h2>{entry.title}</h2>
                  {winner ? (
                    <p className={styles.winner}>
                      <Avatar
                        name={winner.name}
                        src={winner.avatarSrc}
                        initials={winner.initials}
                        size="sm"
                        tone="reward"
                      />
                      Ganador: <strong>{winner.name}</strong>
                    </p>
                  ) : null}
                  <ButtonLink
                    href={`/salas/${roomId}/historial/${entry.challengeId}`}
                    variant="secondary"
                    size="sm"
                    className={styles.historyAction}
                    trailingIcon={<ChevronIcon aria-hidden="true" />}
                  >
                    Ver ranking
                  </ButtonLink>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card as="section" surface="soft" className={styles.emptyState}>
          <h2>Aún no hay partidas.</h2>
        </Card>
      )}
    </Canvas>
  );
}
