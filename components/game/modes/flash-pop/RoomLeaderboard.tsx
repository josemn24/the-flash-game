import { Avatar, Card, TrophyIcon } from "@/components/ui";
import type { RoomDailyLeaderboardEntry, RoomLeaderboardEntry } from "@/types/game";
import styles from "./RoomLeaderboard.module.css";

export type RoomLeaderboardProps = {
  title: string;
  eyebrow?: string;
  entries: Array<RoomLeaderboardEntry | RoomDailyLeaderboardEntry>;
  currentUserId: string;
  daily?: boolean;
  compact?: boolean;
};

export function RoomLeaderboard({
  title,
  eyebrow,
  entries,
  currentUserId,
  daily = false,
  compact = false,
}: RoomLeaderboardProps) {
  return (
    <Card
      as="section"
      className={`${styles.card} ${compact ? styles.compact : ""}`}
      aria-labelledby={`${daily ? "daily" : "room"}-leaderboard-title`}
    >
      <div className={styles.heading}>
        <div>
          {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
          <h2 id={`${daily ? "daily" : "room"}-leaderboard-title`}>{title}</h2>
        </div>
        <TrophyIcon className={styles.headingIcon} />
      </div>

      {entries.length > 0 ? (
        <ol className={styles.list}>
          {entries.map((entry) => {
            const dailyEntry = daily ? (entry as RoomDailyLeaderboardEntry) : null;
            const isCurrentUser = entry.memberId === currentUserId;

            return (
              <li
                className={`${styles.row} ${isCurrentUser ? styles.current : ""}`}
                key={entry.memberId}
              >
                <span className={styles.rank}>{entry.rank}</span>
                <Avatar
                  name={entry.name}
                  initials={entry.initials}
                  tone={isCurrentUser ? "social" : "blue"}
                  size="sm"
                />
                <span className={styles.name}>
                  <strong>{isCurrentUser ? "Tú" : entry.name}</strong>
                  {daily ? (
                    <small>{dailyEntry?.completed ? "Completado" : "Pendiente"}</small>
                  ) : null}
                </span>
                <span className={styles.points}>
                  {entry.points} <small>gemas</small>
                </span>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className={styles.empty}>Sin reto disponible hoy.</p>
      )}
    </Card>
  );
}
