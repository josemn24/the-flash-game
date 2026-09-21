"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar, BoltIcon, Card, ChevronIcon, TrophyIcon } from "@/components/ui";
import type { RoomDailyLeaderboardEntry, RoomLeaderboardEntry } from "@/types/game";
import styles from "./RoomLeaderboard.module.css";

export type RoomLeaderboardProps = {
  title: string;
  eyebrow?: string;
  entries: Array<RoomLeaderboardEntry | RoomDailyLeaderboardEntry>;
  currentUserId: string;
  daily?: boolean;
  compact?: boolean;
  bare?: boolean;
  headingLevel?: "h1" | "h2";
  variant?: "rows" | "cards";
  pendingCount?: number;
  onEntrySelect?: (entry: RoomLeaderboardEntry | RoomDailyLeaderboardEntry) => void;
  memberHrefBase?: string;
};

export function RoomLeaderboard({
  title,
  eyebrow,
  entries,
  currentUserId,
  daily = false,
  compact = false,
  bare = false,
  headingLevel = "h2",
  variant = "rows",
  pendingCount = 0,
  onEntrySelect,
  memberHrefBase,
}: RoomLeaderboardProps) {
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const isCards = variant === "cards";
  const titleId = `${daily ? "daily" : "room"}-leaderboard-title`;
  const Heading = headingLevel;
  const content = (
    <>
      <div className={styles.heading}>
        <div>
          {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
          <Heading id={titleId}>{title}</Heading>
        </div>
        <TrophyIcon className={styles.headingIcon} />
      </div>

      {entries.length > 0 ? (
        <>
          <ol className={styles.list}>
            {entries.map((entry) => {
              const isCurrentUser = entry.memberId === currentUserId;

              return variant === "cards" ? (
                <li className={styles.cardItem} key={entry.memberId}>
                  {memberHrefBase ? (
                    <Link
                      href={`${memberHrefBase}/${entry.memberId}`}
                      className={`${styles.playerCard} ${isCurrentUser ? styles.current : ""}`}
                      aria-label={`Ver detalle de ${entry.name}, ${entry.points} Flash Points`}
                      data-rank={entry.rank}
                    >
                      <span className={styles.cardRank}>#{entry.rank}</span>
                      <Avatar
                        name={entry.name}
                        src={entry.avatarSrc}
                        initials={entry.initials}
                        tone={isCurrentUser ? "social" : "blue"}
                        size="md"
                      />
                      <span className={styles.cardName}>
                        <strong>{entry.name}</strong>
                      </span>
                      <span className={styles.cardPoints}>
                        <BoltIcon aria-hidden="true" />
                        <strong>{entry.points}</strong>
                      </span>
                      <ChevronIcon className={styles.cardArrow} aria-hidden="true" />
                    </Link>
                  ) : <button
                    type="button"
                    className={`${styles.playerCard} ${isCurrentUser ? styles.current : ""} ${selectedMemberId === entry.memberId ? styles.selected : ""}`}
                    aria-label={`Ver detalle de ${entry.name}, ${entry.points} Flash Points`}
                    aria-pressed={selectedMemberId === entry.memberId}
                    data-rank={entry.rank}
                    onClick={() => {
                      const isSelected = selectedMemberId === entry.memberId;
                      setSelectedMemberId(isSelected ? null : entry.memberId);
                      if (!isSelected) onEntrySelect?.(entry);
                    }}
                  >
                    <span className={styles.cardRank}>#{entry.rank}</span>
                    <Avatar
                      name={entry.name}
                      src={entry.avatarSrc}
                      initials={entry.initials}
                      tone={isCurrentUser ? "social" : "blue"}
                      size="md"
                    />
                    <span className={styles.cardName}>
                      <strong>{entry.name}</strong>
                    </span>
                    <span className={styles.cardPoints}>
                      <BoltIcon aria-hidden="true" />
                      <strong>{entry.points}</strong>
                    </span>
                    <ChevronIcon className={styles.cardArrow} aria-hidden="true" />
                  </button>}
                </li>
              ) : (
                <li
                  className={`${styles.row} ${isCurrentUser ? styles.current : ""}`}
                  key={entry.memberId}
                >
                  <span className={styles.rank}>{entry.rank}</span>
                  <Avatar
                    name={entry.name}
                    src={entry.avatarSrc}
                    initials={entry.initials}
                    tone={isCurrentUser ? "social" : "blue"}
                    size="sm"
                  />
                  <span className={styles.name}>
                    <strong>{entry.name}</strong>
                  </span>
                  <span
                    className={styles.points}
                    role="img"
                    aria-label={`${entry.points} Flash Points`}
                  >
                    <BoltIcon aria-hidden="true" />
                    <strong>{entry.points}</strong>
                  </span>
                </li>
              );
            })}
          </ol>
          {isCards && pendingCount > 0 ? (
            <p className={styles.pendingSummary}>{formatPendingCount(pendingCount)}</p>
          ) : null}
        </>
      ) : (
        <>
          <p className={styles.empty}>
            {daily ? "Todavía no ha jugado nadie." : "Sin reto disponible hoy."}
          </p>
          {isCards && pendingCount > 0 ? (
            <p className={styles.pendingSummary}>{formatPendingCount(pendingCount)}</p>
          ) : null}
        </>
      )}
    </>
  );

  if (bare || isCards) {
    return (
      <section
        className={`${styles.bare} ${isCards ? styles.cardsSection : ""}`}
        aria-labelledby={titleId}
      >
        {content}
      </section>
    );
  }

  return (
    <Card
      as="section"
      className={`${styles.card} ${compact ? styles.compact : ""}`}
      aria-labelledby={titleId}
    >
      {content}
    </Card>
  );
}

function formatPendingCount(count: number) {
  return `${count} ${count === 1 ? "pendiente" : "pendientes"} por jugar`;
}
