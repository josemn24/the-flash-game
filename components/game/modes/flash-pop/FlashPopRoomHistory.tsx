import Image from "next/image";
import Link from "next/link";
import { ArrowIcon, Avatar, Canvas, Card, Chip } from "@/components/ui";
import { ROOM_ART_FALLBACK } from "@/lib/roomCard";
import type { RoomHistoryEntry, RoomMember } from "@/types/game";
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
  roomTitle,
  members,
  entries,
}: {
  roomId: string;
  roomTitle: string;
  members: Pick<RoomMember, "id" | "name" | "initials">[];
  entries: RoomHistoryEntry[];
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
        <h1>Historial</h1>
      </div>

      {entries.length > 0 ? (
        <div className={styles.historyList}>
          {entries.map((entry) => {
            const winner = members.find((member) => member.id === entry.winnerMemberId);

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
                      <Avatar name={winner.name} initials={winner.initials} size="sm" tone="reward" />
                      Ganador: <strong>{winner.name}</strong>
                    </p>
                  ) : null}
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
