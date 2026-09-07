"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import {
  ArrowIcon,
  Avatar,
  BoltIcon,
  ButtonLink,
  Canvas,
  Card,
  Chip,
  IconButton,
  RotateIcon,
  SettingsIcon,
  TrophyIcon,
} from "@/components/ui";
import { formatDailyCountdown, getDailyCountdownSeconds } from "@/lib/dailyCountdown";
import { ROOM_ART_FALLBACK } from "@/lib/roomCard";
import type { RoomDetailModel } from "@/types/game";
import { RoomLeaderboard } from "./RoomLeaderboard";
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

  return (
    <span className={styles.countdown} role="timer" aria-live="polite" aria-label="Tiempo restante">
      <span aria-hidden="true">⌛</span>
      <span>{remaining === null ? "--:--:--" : formatDailyCountdown(remaining)}</span>
    </span>
  );
}

function StatPill({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: ReactNode;
}) {
  return (
    <span className={styles.statPill} aria-label={`${label}: ${value}`}>
      <span className={styles.statIcon} aria-hidden="true">
        {icon}
      </span>
      <strong>{value}</strong>
      <span className={styles.visuallyHidden}>{label}</span>
    </span>
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
            sizes="(max-width: 760px) 100vw, 760px"
          />
          <Chip className={styles.artBadge} variant="data">
            Sin reto hoy
          </Chip>
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
          sizes="(max-width: 760px) 100vw, 760px"
        />
        <div className={styles.challengeOverlay}>
          <Chip variant="data">
            {model.currentUser.dailyCompleted ? "Completado" : "Pendiente"}
          </Chip>
          <DailyCountdown endsAt={challenge.endsAt} />
        </div>
        <div className={styles.challengeTitleBadge}>
          <h2 id="daily-challenge-title">{challenge.title}</h2>
        </div>
      </div>

      <div className={styles.challengeFooter}>
        <span className={styles.questionCount}>
          <strong>{challenge.questionCount}</strong> preguntas
        </span>
        <ButtonLink href={challenge.href} size="sm" trailingIcon={<ArrowIcon />}>
          Jugar
        </ButtonLink>
      </div>
    </Card>
  );
}

export function FlashPopRoomDetail({ model }: { model: RoomDetailModel }) {
  const rankingHref = `/salas/${model.roomId}/ranking`;
  const historyHref = `/salas/${model.roomId}/historial`;

  return (
    <Canvas contentClassName={styles.content}>
      <header className={styles.toolbar}>
        <Link href="/" className={styles.toolbarIcon} aria-label="Volver a Tus salas">
          <ArrowIcon className={styles.backIcon} />
        </Link>

        <div className={styles.toolbarCenter}>
          <Link
            href={rankingHref}
            className={styles.roomIdentity}
            aria-label={`Ver ranking global de ${model.title}`}
          >
            <Avatar
              name={model.title}
              initials={model.title.slice(0, 2).toUpperCase()}
              tone="social"
              size="md"
            />
            <span className={styles.roomName}>{model.title}</span>
          </Link>
          <IconButton label="Configuración de sala, próximamente" disabled>
            <SettingsIcon />
          </IconButton>
        </div>

        <Link
          href={historyHref}
          className={`${styles.toolbarIcon} ${styles.historyLink}`}
          aria-label={`Ver historial de ${model.title}`}
        >
          <RotateIcon />
        </Link>
      </header>

      <div className={styles.summary} aria-label="Resumen de la sala">
        <StatPill label="Gemas" value={model.currentUser.totalPoints} icon={<BoltIcon />} />
        <StatPill
          label="Ranking global"
          value={`#${model.currentUser.roomRank}`}
          icon={<TrophyIcon />}
        />
      </div>

      <div className={styles.roomMain}>
        <p className={styles.todayLabel}>HOY</p>
        <DailyChallengeCard model={model} />

        {model.dailyChallenge && model.dailyLeaderboard.length > 0 ? (
          <RoomLeaderboard
            title="Ranking de hoy"
            entries={model.dailyLeaderboard}
            currentUserId={model.currentUser.id}
            daily
            compact
          />
        ) : null}
      </div>
    </Canvas>
  );
}
