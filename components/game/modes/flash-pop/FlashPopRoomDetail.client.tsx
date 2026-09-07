"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowIcon,
  Avatar,
  BoltIcon,
  ButtonLink,
  Canvas,
  Card,
  Chip,
  TrophyIcon,
} from "@/components/ui";
import {
  formatDailyCountdown,
  getDailyCountdownSeconds,
} from "@/lib/dailyCountdown";
import { ROOM_ART_FALLBACK } from "@/lib/roomCard";
import type {
  RoomDailyLeaderboardEntry,
  RoomDetailModel,
  RoomLeaderboardEntry,
} from "@/types/game";
import styles from "./FlashPopRoomDetail.module.css";

function DailyCountdown({ endsAt }: { endsAt: string }) {
  const router = useRouter();
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    let refreshed = false;

    const update = () => {
      const next = getDailyCountdownSeconds(endsAt);
      setRemaining(next);

      if (next === 0 && !refreshed) {
        refreshed = true;
        router.refresh();
      }
    };

    update();
    const intervalId = window.setInterval(update, 1000);
    return () => window.clearInterval(intervalId);
  }, [endsAt, router]);

  const display = remaining === null ? "--:--:--" : formatDailyCountdown(remaining);

  return (
    <span className={styles.countdown} role="timer" aria-live="polite" aria-label="Tiempo restante">
      <span className={styles.countdownIcon} aria-hidden="true">
        ⏳
      </span>
      <span>{display}</span>
    </span>
  );
}

function LeaderboardRow({
  entry,
  currentUserId,
  daily = false,
}: {
  entry: RoomLeaderboardEntry | RoomDailyLeaderboardEntry;
  currentUserId: string;
  daily?: boolean;
}) {
  const dailyEntry = daily ? (entry as RoomDailyLeaderboardEntry) : null;
  const isCurrentUser = entry.memberId === currentUserId;

  return (
    <li className={`${styles.leaderboardRow} ${isCurrentUser ? styles.currentRow : ""}`}>
      <span className={styles.rankNumber}>{entry.rank}</span>
      <Avatar
        name={entry.name}
        initials={entry.initials}
        tone={isCurrentUser ? "social" : "blue"}
        size="sm"
      />
      <span className={styles.playerName}>
        <strong>{isCurrentUser ? "Tú" : entry.name}</strong>
        <small>
          {daily ? (dailyEntry?.completed ? "Completado" : "Pendiente") : "Puntos de sala"}
        </small>
      </span>
      <span className={styles.rowPoints}>
        {entry.points} <small>gemas</small>
      </span>
    </li>
  );
}

function LeaderboardCard({
  title,
  eyebrow,
  entries,
  currentUserId,
  daily = false,
}: {
  title: string;
  eyebrow: string;
  entries: Array<RoomLeaderboardEntry | RoomDailyLeaderboardEntry>;
  currentUserId: string;
  daily?: boolean;
}) {
  return (
    <Card as="section" className={styles.leaderboardCard} aria-labelledby={`${daily ? "daily" : "room"}-leaderboard-title`}>
      <div className={styles.cardHeading}>
        <div>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h2 id={`${daily ? "daily" : "room"}-leaderboard-title`}>{title}</h2>
        </div>
        <TrophyIcon className={styles.headingIcon} />
      </div>

      {entries.length > 0 ? (
        <ol className={styles.leaderboardList}>
          {entries.map((entry) => (
            <LeaderboardRow
              entry={entry}
              currentUserId={currentUserId}
              daily={daily}
              key={entry.memberId}
            />
          ))}
        </ol>
      ) : (
        <p className={styles.emptyRanking}>Sin reto disponible hoy.</p>
      )}
    </Card>
  );
}

function DailyChallengeCard({ model }: { model: RoomDetailModel }) {
  const challenge = model.dailyChallenge;

  if (!challenge) {
    return (
      <Card as="section" elevation="hero" padding="none" className={styles.challengeCard}>
        <div className={styles.challengeArt}>
          <Image
            src={ROOM_ART_FALLBACK}
            alt="Ilustración genérica de Flash Pop"
            fill
            priority
            sizes="(max-width: 760px) 100vw, 58vw"
          />
        </div>
        <div className={styles.challengeBody}>
          <p className={styles.eyebrow}>
            <BoltIcon /> Reto de hoy
          </p>
          <h2>Sin reto hoy.</h2>
          <p className={styles.challengeCopy}>
            No hay ningún desafío jugable disponible en esta sala.
          </p>
          <Chip tone="neutral">Sala activa</Chip>
        </div>
      </Card>
    );
  }

  return (
    <Card
      as="section"
      elevation="hero"
      padding="none"
      className={styles.challengeCard}
      aria-labelledby="daily-challenge-title"
    >
      <div className={styles.challengeArt}>
        <Image
          src={challenge.imageSrc}
          alt={`Ilustración del desafío ${challenge.title}`}
          fill
          priority
          sizes="(max-width: 760px) 100vw, 58vw"
        />
        <Chip className={styles.artBadge} variant="data">
          Desafío de hoy
        </Chip>
      </div>

      <div className={styles.challengeBody}>
        <div className={styles.challengeTopline}>
          <p className={styles.eyebrow}>
            <BoltIcon /> Reto de hoy
          </p>
          <Chip tone={model.currentUser.dailyCompleted ? "success" : "social"}>
            {model.currentUser.dailyCompleted ? "Completado" : "Pendiente"}
          </Chip>
        </div>
        <h2 id="daily-challenge-title">{challenge.title}</h2>
        <p className={styles.challengeCopy}>{challenge.subtitle}</p>

        <div className={styles.challengeMeta}>
          <span>
            <strong>{challenge.questionCount}</strong> preguntas
          </span>
          <span>
            <strong>{model.currentUser.dailyPoints}</strong> gemas
          </span>
        </div>

        <div className={styles.challengeFooter}>
          <span className={styles.expiresLabel}>Termina en</span>
          <DailyCountdown endsAt={challenge.endsAt} />
        </div>

        <ButtonLink
          href={challenge.href}
          size="hero"
          fullWidth
          trailingIcon={<ArrowIcon />}
        >
          {model.currentUser.dailyCompleted ? "Volver a jugar" : "Jugar desafío"}
        </ButtonLink>
      </div>
    </Card>
  );
}

export function FlashPopRoomDetail({ model }: { model: RoomDetailModel }) {
  const isActive = model.seasonStatus === "active";

  return (
    <Canvas contentClassName={styles.content}>
      <header className={styles.pageHeader}>
        <Link href="/" className={styles.backLink} aria-label="Volver a Tus salas">
          <ArrowIcon />
          <span>Tus salas</span>
        </Link>

        <div className={styles.roomIdentity}>
          <Avatar
            name={model.title}
            initials={model.title.slice(0, 2).toUpperCase()}
            tone="social"
            size="md"
          />
          <span>
            <small>Sala</small>
            <strong>{model.title}</strong>
          </span>
        </div>

        <Chip tone={isActive ? "success" : "neutral"}>
          {isActive ? "En directo" : "Cerrada"}
        </Chip>
      </header>

      <section className={styles.intro} aria-labelledby="room-detail-title">
        <div>
          <p className={styles.eyebrow}>{model.seasonTitle}</p>
          <h1 id="room-detail-title">{model.title}.</h1>
          <p className={styles.introCopy}>El reto de hoy y las posiciones de tu sala.</p>
        </div>

        <div className={styles.summaryGrid} aria-label="Resumen de tu sala">
          <Card as="div" padding="compact" className={styles.summaryCard}>
            <span>Mis gemas</span>
            <strong>{model.currentUser.totalPoints}</strong>
          </Card>
          <Card as="div" padding="compact" className={styles.summaryCard}>
            <span>Ranking sala</span>
            <strong>#{model.currentUser.roomRank}</strong>
          </Card>
        </div>
      </section>

      <main className={styles.detailGrid}>
        <DailyChallengeCard model={model} />

        <div className={styles.rankingsGrid}>
          <LeaderboardCard
            title="Ranking de sala"
            eyebrow="Puntos acumulados"
            entries={model.roomLeaderboard}
            currentUserId={model.currentUser.id}
          />
          <LeaderboardCard
            title="Reto de hoy"
            eyebrow="Puntos del desafío"
            entries={model.dailyLeaderboard}
            currentUserId={model.currentUser.id}
            daily
          />
        </div>
      </main>
    </Canvas>
  );
}
