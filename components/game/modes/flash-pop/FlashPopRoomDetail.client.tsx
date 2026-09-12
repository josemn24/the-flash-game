"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import {
  ArrowIcon,
  BoltIcon,
  ButtonLink,
  Canvas,
  Card,
  Chip,
  RotateIcon,
  SettingsIcon,
  TrophyIcon,
} from "@/components/ui";
import { formatDailyCountdown, getDailyCountdownSeconds } from "@/lib/dailyCountdown";
import { applyRoomChallengeResult } from "@/lib/roomDetail";
import { ROOM_ART_FALLBACK } from "@/lib/roomCard";
import { useRoomSession } from "@/features/rooms/RoomSessionProvider.client";
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

function StatItem({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: ReactNode;
}) {
  return (
    <span className={styles.statItem}>
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
        <span className={styles.challengeFormat}>{challenge.formatLabel}</span>
        <ButtonLink href={challenge.href} size="sm" trailingIcon={<ArrowIcon />}>
          Jugar
        </ButtonLink>
      </div>
    </Card>
  );
}

export function FlashPopRoomDetail({ model }: { model: RoomDetailModel }) {
  const { getCompletion } = useRoomSession();
  const completion = model.dailyChallenge
    ? getCompletion(model.roomId, model.dailyChallenge.id)
    : undefined;
  const visibleModel = completion
    ? applyRoomChallengeResult(model, {
        roomId: model.roomId,
        challengeId: model.dailyChallenge?.id ?? "",
        points: completion.points,
        completed: completion.completed,
        playedAt: completion.attempt?.playedAt ?? new Date().toISOString(),
        answers: completion.attempt?.answers ?? [],
      })
    : model;

  const rankingHref = `/salas/${visibleModel.roomId}/ranking`;
  const historyHref = `/salas/${visibleModel.roomId}/historial`;
  const pendingCount = Math.max(
    0,
    visibleModel.roomLeaderboard.length - visibleModel.dailyLeaderboard.length,
  );

  return (
    <Canvas contentClassName={styles.content}>
      <header className={styles.toolbar}>
        <Link href="/" className={styles.toolbarIcon} aria-label="Volver a Tus salas">
          <ArrowIcon className={styles.backIcon} />
        </Link>

        <div className={styles.toolbarCenter}>
          <Link
            href={`/salas/${visibleModel.roomId}/ajustes`}
            className={styles.roomSettingsLink}
            aria-label={`Abrir ajustes de ${visibleModel.title}`}
          >
            <span className={styles.roomSettingsLabel}>{visibleModel.title}</span>
            <SettingsIcon />
          </Link>
        </div>

        <Link
          href={historyHref}
          className={`${styles.toolbarIcon} ${styles.historyLink}`}
          aria-label={`Ver historial de ${model.title}`}
        >
          <RotateIcon />
        </Link>
      </header>

      <Link
        href={rankingHref}
        className={styles.statPill}
        aria-label={`Ver ranking de la sala: ${visibleModel.currentUser.totalPoints} Flash Points, posición ${visibleModel.currentUser.roomRank}`}
      >
        <StatItem label="Flash Points" value={visibleModel.currentUser.totalPoints} icon={<BoltIcon />} />
        <StatItem
          label="Posición"
          value={`#${visibleModel.currentUser.roomRank}`}
          icon={<TrophyIcon />}
        />
      </Link>

      <div className={styles.roomMain}>
        <p className={styles.todayLabel}>HOY</p>
        <DailyChallengeCard model={visibleModel} />

        {visibleModel.dailyChallenge ? (
          <div className={styles.dailyRanking}>
            <RoomLeaderboard
              title="Ranking de hoy"
              entries={visibleModel.dailyLeaderboard}
              currentUserId={visibleModel.currentUser.id}
              daily
              compact
              variant="cards"
              pendingCount={pendingCount}
              memberHrefBase={`/salas/${visibleModel.roomId}/ranking`}
            />
          </div>
        ) : null}
      </div>
    </Canvas>
  );
}
