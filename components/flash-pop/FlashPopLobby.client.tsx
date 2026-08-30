"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  PopAvatar,
  PopAvatarStack,
  PopButtonLink,
  PopCanvas,
  PopCard,
  PopChip,
  PopIconButton,
  type PopAvatarData,
} from "@/components/flash-pop/ui";
import { ArrowIcon, BellIcon, BoltIcon, TrophyIcon } from "@/components/icons";
import {
  parsePyramidAttempt,
  getPyramidAttemptStorageKey,
} from "@/features/pyramid/pyramidAttempt";
import {
  FLASH_POP_CHALLENGE_ID,
  FLASH_POP_SECONDARY_CHALLENGE_ID,
  FLASH_POP_STORAGE_NAMESPACE,
  getFlashPopLobbyChallenge,
  flashPopPlayers,
} from "@/features/flash-pop/demoSocial";
import type { PyramidChallenge } from "@/types/game";
import styles from "@/app/flash-pop/FlashPop.module.css";

const players: PopAvatarData[] = flashPopPlayers.slice(1).map((player) => ({
  id: player.id,
  name: player.displayName,
  initials: player.initials,
  tone: player.tone,
}));

function getActionLabel(status: ReturnType<typeof getFlashPopLobbyChallenge>["status"]) {
  return status === "available"
    ? "Jugar ahora"
    : status === "inProgress"
      ? "Continuar"
      : "Ver resultado";
}

function getStatusLabel(status: ReturnType<typeof getFlashPopLobbyChallenge>["status"]) {
  return status === "completed"
    ? "Completado"
    : status === "notCompleted"
      ? "No completado"
      : status === "inProgress"
        ? "En curso"
        : "Nuevo";
}

export function FlashPopLobby({
  primaryChallenge,
  secondaryChallenge,
}: {
  primaryChallenge: PyramidChallenge;
  secondaryChallenge: PyramidChallenge;
}) {
  const flashPopChallenges = useMemo(
    () => ({ primary: primaryChallenge, secondary: secondaryChallenge }),
    [primaryChallenge, secondaryChallenge],
  );
  const [primaryModel, setPrimaryModel] = useState(() =>
    getFlashPopLobbyChallenge(null, FLASH_POP_CHALLENGE_ID),
  );
  const [secondaryModel, setSecondaryModel] = useState(() =>
    getFlashPopLobbyChallenge(null, FLASH_POP_SECONDARY_CHALLENGE_ID),
  );

  useEffect(() => {
    const storageEntries = (
      [
        {
          challenge: flashPopChallenges.primary,
          challengeId: FLASH_POP_CHALLENGE_ID,
          setModel: setPrimaryModel,
        },
        {
          challenge: flashPopChallenges.secondary,
          challengeId: FLASH_POP_SECONDARY_CHALLENGE_ID,
          setModel: setSecondaryModel,
        },
      ] as const
    ).map((entry) => ({
      ...entry,
      storageKey: getPyramidAttemptStorageKey(entry.challenge, FLASH_POP_STORAGE_NAMESPACE),
    }));

    const sync = (entry: (typeof storageEntries)[number], serialized: string | null) => {
      const record = serialized ? parsePyramidAttempt(serialized, entry.challenge) : null;
      entry.setModel(getFlashPopLobbyChallenge(record, entry.challengeId));
    };

    storageEntries.forEach((entry) => sync(entry, window.localStorage.getItem(entry.storageKey)));
    const onStorage = (event: StorageEvent) => {
      const entry = storageEntries.find((candidate) => candidate.storageKey === event.key);
      if (entry) sync(entry, event.newValue);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [flashPopChallenges]);

  const actionLabel = getActionLabel(primaryModel.status);
  const progress = Math.min(
    100,
    Math.round((primaryModel.seasonXp.current / primaryModel.seasonXp.nextLevelAt) * 100),
  );
  const playerById = (id: string) => flashPopPlayers.find((player) => player.id === id)!;

  return (
    <PopCanvas contentClassName={styles.shell}>
      <header className={styles.appHeader}>
        <div className={styles.brand} aria-label="Flash Pop">
          <span className={styles.brandMark}>
            <BoltIcon />
          </span>
          <span>Flash Pop</span>
        </div>

        <div className={styles.identity}>
          <PopAvatar name="Javi Moreno" initials="JM" tone="social" size="md" />
          <span className={styles.identityCopy}>
            <strong>Hola, Javi</strong>
            <small>Tabarnia · Día 7</small>
          </span>
        </div>

        <div className={styles.headerActions}>
          <PopChip tone="social" className={styles.previewBadge}>
            Preview
          </PopChip>
          <PopChip icon={<BoltIcon />}>Nv. 4</PopChip>
          <PopIconButton label="Notificaciones" className={styles.notificationButton}>
            <BellIcon />
          </PopIconButton>
        </div>
      </header>

      <section className={styles.welcome}>
        <div>
          <p className={styles.eyebrow}>Reto disponible · Demo</p>
          <h1>Hoy toca subir.</h1>
        </div>
        <p>Un solo intento. Llega tan alto como puedas y supera a tu grupo.</p>
      </section>

      <div className={styles.dashboard}>
        <PopCard
          as="section"
          elevation="hero"
          padding="none"
          className={styles.challengeCard}
          aria-labelledby="flash-pop-challenge-title"
        >
          <div className={styles.heroArt}>
            <Image
              src="/flash-pop/concepts/pyramid-soft-diorama.webp"
              alt="Diorama suave de una pirámide rodeada por energía amarilla"
              fill
              priority
              sizes="(max-width: 760px) 100vw, (max-width: 1080px) 62vw, 720px"
              className={styles.heroImage}
            />
            <div className={styles.heroBadges}>
              <PopChip tone={primaryModel.status === "completed" ? "success" : "social"}>
                {getStatusLabel(primaryModel.status)}
              </PopChip>
              <PopChip variant="data">Preview</PopChip>
            </div>
          </div>

          <div className={styles.challengeBody}>
            <div className={styles.modeLabel}>
              <BoltIcon /> Reto de hoy
            </div>
            <h2 id="flash-pop-challenge-title">{primaryModel.title}</h2>
            <p className={styles.challengeCopy}>{primaryModel.subtitle}</p>
            {primaryModel.status === "inProgress" &&
            typeof primaryModel.currentLevelIndex === "number" ? (
              <p className={styles.progressCopy}>
                En curso · Nivel {Math.min(primaryModel.currentLevelIndex + 1, 7)} de 7
              </p>
            ) : null}
            <div className={styles.socialRow}>
              <PopAvatarStack
                items={players}
                maxVisible={3}
                label={`${primaryModel.participants.length} ya jugaron`}
              />
              <PopChip variant="reward" icon={<BoltIcon />} className={styles.rewardChip}>
                Hasta +120
              </PopChip>
            </div>
            <PopButtonLink
              href={`/flash-pop/desafios/${primaryModel.id}`}
              size="hero"
              fullWidth
              trailingIcon={<ArrowIcon />}
            >
              {actionLabel}
            </PopButtonLink>
            <p className={styles.attemptNote}>
              7 niveles · Tu primer acceso inicia el único intento oficial.
            </p>
          </div>
        </PopCard>

        <aside className={styles.sideColumn} aria-label="Temporada y actividad">
          <PopCard as="section" className={styles.seasonCard}>
            <div className={styles.cardHeading}>
              <div>
                <p className={styles.eyebrow}>Temporada</p>
                <h2>
                  {primaryModel.playerRank
                    ? `Vas ${primaryModel.playerRank}.º de ${primaryModel.totalPlayers}`
                    : "Vas 4.º de 8"}
                </h2>
              </div>
              <span className={styles.seasonValue}>
                {primaryModel.seasonXp.current} / {primaryModel.seasonXp.nextLevelAt} ⚡
              </span>
            </div>
            <div className={styles.progressTrack} aria-label={`${progress} % del nivel completado`}>
              <span style={{ width: `${progress}%` }} />
            </div>
            <p className={styles.progressCopy}>
              {Math.max(0, primaryModel.seasonXp.nextLevelAt - primaryModel.seasonXp.current)} rayos
              para alcanzar el siguiente nivel.
            </p>
          </PopCard>

          <PopCard as="section" className={styles.secondaryChallengeCard}>
            <div className={styles.secondaryChallengeArt}>
              <Image
                src="/flash-pop/concepts/pyramid-soft-diorama.webp"
                alt="Diorama suave de la segunda Pirámide"
                fill
                sizes="120px"
                className={styles.secondaryChallengeImage}
              />
            </div>
            <div className={styles.secondaryChallengeBody}>
              <div className={styles.cardHeading}>
                <p className={styles.eyebrow}>Siguiente preview</p>
                <PopChip tone={secondaryModel.status === "completed" ? "success" : "social"}>
                  {getStatusLabel(secondaryModel.status)}
                </PopChip>
              </div>
              <h2>{secondaryModel.title}</h2>
              <p className={styles.challengeCopy}>{secondaryModel.subtitle}</p>
              {secondaryModel.status === "inProgress" &&
              typeof secondaryModel.currentLevelIndex === "number" ? (
                <p className={styles.progressCopy}>
                  Nivel {Math.min(secondaryModel.currentLevelIndex + 1, 7)} de 7
                </p>
              ) : null}
              <PopButtonLink
                href={`/flash-pop/desafios/${secondaryModel.id}`}
                fullWidth
                trailingIcon={<ArrowIcon />}
              >
                {getActionLabel(secondaryModel.status)}
              </PopButtonLink>
            </div>
          </PopCard>

          <PopCard as="section" className={styles.classicPreviewCard}>
            <p className={styles.eyebrow}>Nuevo preview</p>
            <h2>Flash clásico, en versión Pop</h2>
            <p className={styles.challengeCopy}>
              Juega las 16 preguntas del reto original con la nueva presentación clara y eléctrica.
            </p>
            <PopButtonLink
              href="/flash-pop/flash/tabarnia-flash-01"
              variant="secondary"
              fullWidth
              trailingIcon={<ArrowIcon />}
            >
              Probar Flash clásico
            </PopButtonLink>
          </PopCard>

          <PopCard as="section" className={styles.activitySection}>
            <div className={styles.cardHeading}>
              <div>
                <p className={styles.eyebrow}>Tu grupo</p>
                <h2>Actividad reciente</h2>
              </div>
              <PopChip tone="social">Demo</PopChip>
            </div>
            <div className={styles.activityList}>
              {primaryModel.activities.map((activity) => {
                const player = playerById(activity.playerId);
                return (
                  <PopCard
                    as="article"
                    elevation="flat"
                    padding="compact"
                    className={styles.activityItem}
                    key={activity.id}
                  >
                    <PopAvatar
                      name={player.displayName}
                      initials={player.initials}
                      tone={player.tone}
                      size="sm"
                    />
                    <p>
                      <strong>{player.displayName}</strong> {activity.text}
                      <small>{activity.meta}</small>
                    </p>
                    <span className={styles.activityIcon}>
                      {activity.icon === "trophy" ? <TrophyIcon /> : <BoltIcon />}
                    </span>
                  </PopCard>
                );
              })}
            </div>
          </PopCard>
        </aside>
      </div>
    </PopCanvas>
  );
}
