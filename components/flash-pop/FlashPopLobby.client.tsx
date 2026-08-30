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

export function FlashPopLobby({ challenge }: { challenge: PyramidChallenge }) {
  const flashPopChallenge = useMemo(() => challenge, [challenge]);
  const [model, setModel] = useState(() => getFlashPopLobbyChallenge(null));

  useEffect(() => {
    const storageKey = getPyramidAttemptStorageKey(flashPopChallenge, FLASH_POP_STORAGE_NAMESPACE);
    const sync = (serialized: string | null) => {
      const record = serialized ? parsePyramidAttempt(serialized, flashPopChallenge) : null;
      setModel(getFlashPopLobbyChallenge(record));
    };

    sync(window.localStorage.getItem(storageKey));
    const onStorage = (event: StorageEvent) => {
      if (event.key === storageKey) sync(event.newValue);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [flashPopChallenge]);

  const actionLabel = getActionLabel(model.status);
  const progress = Math.min(
    100,
    Math.round((model.seasonXp.current / model.seasonXp.nextLevelAt) * 100),
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
              <PopChip tone={model.status === "completed" ? "success" : "social"}>
                {model.status === "completed" ? "Completado" : "Nuevo"}
              </PopChip>
              <PopChip variant="data">Preview</PopChip>
            </div>
          </div>

          <div className={styles.challengeBody}>
            <div className={styles.modeLabel}>
              <BoltIcon /> Reto de hoy
            </div>
            <h2 id="flash-pop-challenge-title">{model.title}</h2>
            <p className={styles.challengeCopy}>{model.subtitle}</p>
            {model.status === "inProgress" && typeof model.currentLevelIndex === "number" ? (
              <p className={styles.progressCopy}>
                En curso · Nivel {Math.min(model.currentLevelIndex + 1, 7)} de 7
              </p>
            ) : null}
            <div className={styles.socialRow}>
              <PopAvatarStack
                items={players}
                maxVisible={3}
                label={`${model.participants.length} ya jugaron`}
              />
              <PopChip variant="reward" icon={<BoltIcon />} className={styles.rewardChip}>
                Hasta +120
              </PopChip>
            </div>
            <PopButtonLink
              href={`/flash-pop/desafios/${FLASH_POP_CHALLENGE_ID}`}
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
                  {model.playerRank
                    ? `Vas ${model.playerRank}.º de ${model.totalPlayers}`
                    : "Vas 4.º de 8"}
                </h2>
              </div>
              <span className={styles.seasonValue}>
                {model.seasonXp.current} / {model.seasonXp.nextLevelAt} ⚡
              </span>
            </div>
            <div className={styles.progressTrack} aria-label={`${progress} % del nivel completado`}>
              <span style={{ width: `${progress}%` }} />
            </div>
            <p className={styles.progressCopy}>
              {Math.max(0, model.seasonXp.nextLevelAt - model.seasonXp.current)} rayos para alcanzar
              el siguiente nivel.
            </p>
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
              {model.activities.map((activity) => {
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
