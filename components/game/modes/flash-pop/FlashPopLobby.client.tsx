"use client";

import Image from "next/image";
import {
  Avatar,
  AvatarStack,
  ButtonLink,
  Canvas,
  Card,
  Chip,
  IconButton,
  type AvatarData,
} from "@/components/ui";
import { ArrowIcon, BellIcon, BoltIcon, TrophyIcon } from "@/components/ui";
import {
  FLASH_POP_CHALLENGE_ID,
  FLASH_POP_SECONDARY_CHALLENGE_ID,
  getFlashPopLobbyChallenge,
  flashPopPlayers,
} from "@/features/flash-pop/demoSocial";
import type { PyramidChallenge } from "@/types/game";
import styles from "@/app/flash-pop/FlashPop.module.css";

const players: AvatarData[] = flashPopPlayers.slice(1).map((player) => ({
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
  const primaryModel = getFlashPopLobbyChallenge(null, FLASH_POP_CHALLENGE_ID);
  const secondaryModel = getFlashPopLobbyChallenge(null, FLASH_POP_SECONDARY_CHALLENGE_ID);

  const actionLabel = getActionLabel(primaryModel.status);
  const progress = Math.min(
    100,
    Math.round((primaryModel.seasonXp.current / primaryModel.seasonXp.nextLevelAt) * 100),
  );
  const playerById = (id: string) => flashPopPlayers.find((player) => player.id === id)!;

  return (
    <Canvas contentClassName={styles.shell}>
      <header className={styles.appHeader}>
        <div className={styles.brand} aria-label="Flash Pop">
          <span className={styles.brandMark}>
            <BoltIcon />
          </span>
          <span>Flash Pop</span>
        </div>

        <div className={styles.identity}>
          <Avatar name="Javi Moreno" initials="JM" tone="social" size="md" />
          <span className={styles.identityCopy}>
            <strong>Hola, Javi</strong>
            <small>Tabarnia · Día 7</small>
          </span>
        </div>

        <div className={styles.headerActions}>
          <Chip tone="social" className={styles.previewBadge}>
            Demo
          </Chip>
          <Chip icon={<BoltIcon />}>Nv. 4</Chip>
          <IconButton label="Notificaciones" className={styles.notificationButton}>
            <BellIcon />
          </IconButton>
        </div>
      </header>

      <section className={styles.welcome}>
        <div>
          <p className={styles.eyebrow}>Reto disponible · Demo</p>
          <h1>Hoy toca subir.</h1>
        </div>
        <p>Llega tan alto como puedas, revisa tu ascenso y supera a tu grupo.</p>
      </section>

      <div className={styles.dashboard}>
        <Card
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
              <Chip tone={primaryModel.status === "completed" ? "success" : "social"}>
                {getStatusLabel(primaryModel.status)}
              </Chip>
              <Chip variant="data">Demo</Chip>
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
                En curso · Nivel{" "}
                {Math.min(primaryModel.currentLevelIndex + 1, primaryChallenge.levels.length)} de{" "}
                {primaryChallenge.levels.length}
              </p>
            ) : null}
            <div className={styles.socialRow}>
              <AvatarStack
                items={players}
                maxVisible={3}
                label={`${primaryModel.participants.length} ya jugaron`}
              />
              <Chip variant="reward" icon={<BoltIcon />} className={styles.rewardChip}>
                Hasta +120
              </Chip>
            </div>
            <ButtonLink
              href={`/flash-pop/desafios/${primaryModel.id}`}
              size="hero"
              fullWidth
              trailingIcon={<ArrowIcon />}
            >
              {actionLabel}
            </ButtonLink>
            <p className={styles.attemptNote}>
              {primaryChallenge.levels.length} niveles · Puedes volver a jugar cuando quieras.
            </p>
          </div>
        </Card>

        <aside className={styles.sideColumn} aria-label="Temporada y actividad">
          <Card as="section" className={styles.seasonCard}>
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
          </Card>

          <Card as="section" className={styles.secondaryChallengeCard}>
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
                <p className={styles.eyebrow}>Siguiente reto · Demo</p>
                <Chip tone={secondaryModel.status === "completed" ? "success" : "social"}>
                  {getStatusLabel(secondaryModel.status)}
                </Chip>
              </div>
              <h2>{secondaryModel.title}</h2>
              <p className={styles.challengeCopy}>{secondaryModel.subtitle}</p>
              {secondaryModel.status === "inProgress" &&
              typeof secondaryModel.currentLevelIndex === "number" ? (
                <p className={styles.progressCopy}>
                  Nivel{" "}
                  {Math.min(secondaryModel.currentLevelIndex + 1, secondaryChallenge.levels.length)}{" "}
                  de {secondaryChallenge.levels.length}
                </p>
              ) : null}
              <ButtonLink
                href={`/flash-pop/desafios/${secondaryModel.id}`}
                fullWidth
                trailingIcon={<ArrowIcon />}
              >
                {getActionLabel(secondaryModel.status)}
              </ButtonLink>
            </div>
          </Card>

          <Card as="section" className={styles.classicPreviewCard}>
            <p className={styles.eyebrow}>Nuevo preview</p>
            <h2>Flash clásico, en versión Pop</h2>
            <p className={styles.challengeCopy}>
              Juega las 16 preguntas del reto original con la nueva presentación clara y eléctrica.
            </p>
            <ButtonLink
              href="/flash-pop/flash/tabarnia-flash-01"
              variant="secondary"
              fullWidth
              trailingIcon={<ArrowIcon />}
            >
              Probar Flash clásico
            </ButtonLink>
          </Card>

          <Card as="section" className={styles.activitySection}>
            <div className={styles.cardHeading}>
              <div>
                <p className={styles.eyebrow}>Tu grupo</p>
                <h2>Actividad reciente</h2>
              </div>
              <Chip tone="social">Demo</Chip>
            </div>
            <div className={styles.activityList}>
              {primaryModel.activities.map((activity) => {
                const player = playerById(activity.playerId);
                return (
                  <Card
                    as="article"
                    elevation="flat"
                    padding="compact"
                    className={styles.activityItem}
                    key={activity.id}
                  >
                    <Avatar
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
                  </Card>
                );
              })}
            </div>
          </Card>
        </aside>
      </div>
    </Canvas>
  );
}
