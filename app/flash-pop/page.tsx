import type { Metadata } from "next";
import Image from "next/image";
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
import styles from "./FlashPop.module.css";

export const metadata: Metadata = {
  title: "Flash Pop — Lobby preview",
  description: "Shell aislado del vertical slice de Flash Pop.",
};

const players: PopAvatarData[] = [
  { id: "ana", name: "Ana", initials: "AM", tone: "coral" },
  { id: "luis", name: "Luis", initials: "LU", tone: "blue" },
  { id: "rocio", name: "Rocío", initials: "RO", tone: "aqua" },
  { id: "joel", name: "Joel", initials: "JO", tone: "ink" },
  { id: "marta", name: "Marta", initials: "MA", tone: "reward" },
  { id: "ines", name: "Inés", initials: "IN", tone: "social" },
];

export default function FlashPopPage() {
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
          <p className={styles.eyebrow}>Reto disponible</p>
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
              <PopChip tone="social">Nuevo</PopChip>
              <PopChip variant="data">2 h 14 min</PopChip>
            </div>
          </div>

          <div className={styles.challengeBody}>
            <div className={styles.modeLabel}>
              <BoltIcon />
              Reto de hoy
            </div>
            <h2 id="flash-pop-challenge-title">La Pirámide</h2>
            <p className={styles.challengeCopy}>Siete niveles. Un fallo termina el ascenso.</p>

            <div className={styles.socialRow}>
              <PopAvatarStack items={players} maxVisible={3} label="6 ya jugaron" />
              <PopChip variant="reward" className={styles.rewardChip}>
                Hasta +120 ⚡
              </PopChip>
            </div>

            <PopButtonLink
              href="/desafios/tabarnia-challenge-05"
              size="hero"
              fullWidth
              trailingIcon={<ArrowIcon />}
            >
              Jugar ahora
            </PopButtonLink>
            <p className={styles.attemptNote}>Tu primer acceso inicia el único intento oficial.</p>
          </div>
        </PopCard>

        <aside className={styles.sideColumn} aria-label="Temporada y actividad">
          <PopCard as="section" className={styles.seasonCard}>
            <div className={styles.cardHeading}>
              <div>
                <p className={styles.eyebrow}>Temporada</p>
                <h2>Vas 4.º de 8</h2>
              </div>
              <span className={styles.seasonValue}>680 / 900 ⚡</span>
            </div>
            <div className={styles.progressTrack} aria-label="76 % del nivel completado">
              <span />
            </div>
            <p className={styles.progressCopy}>220 rayos para alcanzar el siguiente nivel.</p>
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
              <PopCard
                as="article"
                elevation="flat"
                padding="compact"
                className={styles.activityItem}
              >
                <PopAvatar name="Ana" initials="AM" tone="coral" size="sm" />
                <p>
                  <strong>Ana</strong> subió al 1.º puesto
                  <small>Hace 12 min · 91 puntos</small>
                </p>
                <span className={styles.activityIcon}>
                  <TrophyIcon />
                </span>
              </PopCard>
              <PopCard
                as="article"
                elevation="flat"
                padding="compact"
                className={styles.activityItem}
              >
                <PopAvatar name="Luis" initials="LU" tone="blue" size="sm" />
                <p>
                  <strong>Luis</strong> terminó La Pirámide
                  <small>Hace 26 min · +82 ⚡</small>
                </p>
                <span className={styles.activityIcon}>
                  <BoltIcon />
                </span>
              </PopCard>
            </div>
          </PopCard>
        </aside>
      </div>
    </PopCanvas>
  );
}
