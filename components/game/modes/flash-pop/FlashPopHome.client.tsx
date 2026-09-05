import Image from "next/image";
import { ArrowIcon, BoltIcon, ClockIcon } from "@/components/ui";
import { Avatar, ButtonLink, Card, Canvas, Chip, GameHeader } from "@/components/ui";
import { FLASH_POP_FLASH_PILOT_ID } from "@/features/flash-pop/demoSocial";
import type { ChallengeSummary, SeasonStatus } from "@/types/game";
import styles from "./FlashPopHome.module.css";

type FlashPopHomeProps = {
  roomTitle: string;
  seasonTitle: string;
  seasonStatus: SeasonStatus;
  challenges: ChallengeSummary[];
};

function statusLabel(challenge: ChallengeSummary) {
  if (challenge.implementationStatus === "prototype") return "Piloto Pop";
  if (challenge.availabilityStatus === "available") return "Disponible";
  if (challenge.availabilityStatus === "locked") return "Próximamente";
  return "Cerrado";
}

function actionLabel(challenge: ChallengeSummary) {
  if (challenge.id === FLASH_POP_FLASH_PILOT_ID) return "Jugar ahora";
  if (challenge.playable) return "Jugar reto";
  if (challenge.openable) return "Ver preview";
  return "No disponible";
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" }).format(
    new Date(value),
  );
}

function challengeHref(challenge: ChallengeSummary) {
  return challenge.id === FLASH_POP_FLASH_PILOT_ID
    ? "/desafios/tabarnia-flash-01"
    : `/desafios/${challenge.id}`;
}

export function FlashPopHome({
  roomTitle,
  seasonTitle,
  seasonStatus,
  challenges,
}: FlashPopHomeProps) {
  const primaryChallenge =
    challenges.find((challenge) => challenge.id === FLASH_POP_FLASH_PILOT_ID) ??
    challenges.find((challenge) => challenge.playable || challenge.openable) ??
    challenges[0];
  const accessibleChallenges = challenges.filter(
    (challenge) => challenge.playable || challenge.openable,
  );
  const progressPercent = challenges.length
    ? Math.round((accessibleChallenges.length / challenges.length) * 100)
    : 0;

  if (!primaryChallenge) return null;

  return (
    <Canvas contentClassName={styles.content}>
      <GameHeader
        title={roomTitle}
        action={
          <Chip tone={seasonStatus === "active" ? "success" : "neutral"}>
            {seasonStatus === "active" ? "En directo" : "Temporada cerrada"}
          </Chip>
        }
      />

      <section className={styles.welcome} aria-labelledby="flash-pop-home-title">
        <div>
          <p className={styles.eyebrow}>
            <BoltIcon /> Sala de juego
          </p>
          <h1 id="flash-pop-home-title">Elige tu próximo reto.</h1>
          <p className={styles.lead}>
            Preguntas rápidas, feedback instantáneo y una temporada para jugar a tu ritmo.
          </p>
        </div>
        <div className={styles.identity} aria-label="Jugador actual">
          <Avatar name="Jugador" initials="TÚ" tone="social" size="md" />
          <span>
            <strong>Tu sala</strong>
            <small>{seasonTitle}</small>
          </span>
        </div>
      </section>

      <div className={styles.dashboard}>
        <Card
          as="section"
          elevation="hero"
          className={styles.heroCard}
          aria-labelledby="primary-challenge-title"
        >
          <div className={styles.heroArt}>
            <Image
              src="/flash-pop/concepts/pyramid-soft-diorama.webp"
              alt="Ilustración abstracta del reto Flash Pop"
              fill
              priority
              sizes="(max-width: 760px) 100vw, 52vw"
            />
            <span className={styles.heroStamp}>01</span>
          </div>
          <div className={styles.heroBody}>
            <div className={styles.cardMeta}>
              <Chip tone="social">Reto principal</Chip>
              <span>{statusLabel(primaryChallenge)}</span>
            </div>
            <h2 id="primary-challenge-title">{primaryChallenge.title}</h2>
            <p>{primaryChallenge.subtitle}</p>
            <div className={styles.stats} aria-label="Datos del reto">
              <span>
                <strong>{primaryChallenge.questionCount}</strong> preguntas
              </span>
              <span>
                <ClockIcon /> {dateLabel(primaryChallenge.availableUntil)}
              </span>
            </div>
            <ButtonLink
              href={challengeHref(primaryChallenge)}
              size="hero"
              fullWidth
              trailingIcon={<ArrowIcon />}
            >
              {actionLabel(primaryChallenge)}
            </ButtonLink>
          </div>
        </Card>

        <aside className={styles.sideColumn} aria-label="Estado de la temporada">
          <Card
            as="section"
            surface="soft"
            className={styles.seasonCard}
            aria-labelledby="season-progress-title"
          >
            <div className={styles.cardMeta}>
              <Chip variant="data">Temporada</Chip>
              <span>{accessibleChallenges.length} accesibles</span>
            </div>
            <h2 id="season-progress-title">{seasonTitle}</h2>
            <p>Tu progreso de acceso a los retos de esta sala.</p>
            <div
              className={styles.progressTrack}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progressPercent}
              aria-label="Progreso de acceso a retos"
            >
              <span style={{ width: `${progressPercent}%` }} />
            </div>
            <strong className={styles.progressValue}>
              {accessibleChallenges.length}/{challenges.length} retos accesibles
            </strong>
          </Card>

          <Card as="section" className={styles.nextCard} aria-labelledby="next-challenge-title">
            <div className={styles.nextIcon}>
              <BoltIcon />
            </div>
            <div>
              <span className={styles.kicker}>Siguiente movimiento</span>
              <h2 id="next-challenge-title">16 preguntas. Una sola carrera.</h2>
              <p>Responde antes de que se agote el tiempo.</p>
            </div>
          </Card>
        </aside>
      </div>

      <section className={styles.challengeSection} aria-labelledby="all-challenges-title">
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.kicker}>Calendario</span>
            <h2 id="all-challenges-title">Retos de la sala</h2>
          </div>
          <span>{challenges.length} en temporada</span>
        </div>
        <div className={styles.challengeGrid}>
          {challenges.map((challenge) => {
            const canOpen = challenge.playable || challenge.openable;
            return (
              <Card
                as="article"
                key={challenge.id}
                padding="compact"
                className={styles.challengeCard}
              >
                <div className={styles.challengeNumber}>
                  {String(challenge.number).padStart(2, "0")}
                </div>
                <div className={styles.challengeCopy}>
                  <div className={styles.cardMeta}>
                    <span>{statusLabel(challenge)}</span>
                    <span>{dateLabel(challenge.availableFrom)}</span>
                  </div>
                  <h3>{challenge.title}</h3>
                  <p>
                    {challenge.questionCount ? `${challenge.questionCount} preguntas · ` : ""}
                    {challenge.subtitle}
                  </p>
                </div>
                {canOpen ? (
                  <ButtonLink
                    href={challengeHref(challenge)}
                    variant="secondary"
                    aria-label={`${actionLabel(challenge)}: ${challenge.title}`}
                  >
                    <ArrowIcon />
                  </ButtonLink>
                ) : (
                  <span className={styles.locked}>—</span>
                )}
              </Card>
            );
          })}
        </div>
      </section>
    </Canvas>
  );
}
