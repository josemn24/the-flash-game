import Image from "next/image";
import { ArrowIcon, BellIcon, BoltIcon } from "@/components/ui";
import styles from "./FlashPopConcepts.module.css";

export type LobbyConceptProps = {
  id: string;
  name: string;
  summary: string;
  theme: "graphic" | "soft" | "arena";
  selected?: boolean;
  art: string;
  artAlt: string;
  fontClassName?: string;
};

export function LobbyConcept({
  id,
  name,
  summary,
  theme,
  selected = false,
  art,
  artAlt,
  fontClassName = "",
}: LobbyConceptProps) {
  return (
    <article className={`${styles.concept} ${selected ? styles.selectedConcept : ""}`}>
      <header className={styles.conceptHeader}>
        <span className={styles.conceptIndex}>{id}</span>
        <div>
          <h2>{name}</h2>
          <p>{summary}</p>
        </div>
        {selected ? <span className={styles.selectedBadge}>Seleccionada</span> : null}
      </header>

      <div className={`${styles.phone} ${styles[theme]} ${fontClassName}`}>
        <div className={styles.pattern} aria-hidden="true" />

        <header className={styles.appHeader}>
          <div className={styles.identity}>
            <span className={styles.userAvatar}>JM</span>
            <div>
              <p className={styles.greeting}>Hola, Javi</p>
              <p className={styles.room}>Tabarnia · Día 7</p>
            </div>
          </div>

          <div className={styles.headerActions}>
            <span className={styles.levelPill}>
              <BoltIcon />
              Nv. 4
            </span>
            <span className={styles.iconButton}>
              <BellIcon />
            </span>
          </div>
        </header>

        <section className={styles.heroCard} aria-label="Reto de hoy">
          <div className={styles.heroArt}>
            <Image
              src={art}
              alt={artAlt}
              fill
              sizes="390px"
              priority
              className={styles.heroImage}
            />
            <div className={styles.heroBadges}>
              <span className={styles.newBadge}>Nuevo</span>
              <span className={styles.timeBadge}>2 h 14 min</span>
            </div>
          </div>

          <div className={styles.heroBody}>
            <div className={styles.modeLabel}>
              <BoltIcon />
              Reto de hoy
            </div>
            <h3>La Pirámide</h3>
            <p className={styles.challengeCopy}>¿Hasta dónde puedes subir?</p>

            <div className={styles.socialRow}>
              <div className={styles.avatarStack} aria-label="Seis personas ya jugaron">
                <span className={styles.avatarOne}>AM</span>
                <span className={styles.avatarTwo}>LU</span>
                <span className={styles.avatarThree}>RO</span>
                <span className={styles.avatarMore}>+3</span>
              </div>
              <span className={styles.played}>6 ya jugaron</span>
              <span className={styles.reward}>Hasta +120 ⚡</span>
            </div>

            <span className={styles.primaryCta}>
              Jugar ahora
              <ArrowIcon />
            </span>
          </div>
        </section>

        <section className={styles.seasonCard} aria-label="Progreso de temporada">
          <div className={styles.sectionTitleRow}>
            <div>
              <p className={styles.eyebrow}>Temporada</p>
              <p className={styles.seasonPosition}>4.º de 8</p>
            </div>
            <span className={styles.seasonXp}>680 / 900 ⚡</span>
          </div>
          <div className={styles.progressTrack}>
            <span />
          </div>
        </section>

        <section className={styles.activitySection} aria-label="Actividad de tu grupo">
          <div className={styles.sectionTitleRow}>
            <p className={styles.activityTitle}>Actividad de tu grupo</p>
            <span className={styles.viewLabel}>Ver</span>
          </div>
          <div className={styles.activityCard}>
            <span className={`${styles.feedAvatar} ${styles.avatarOne}`}>AM</span>
            <div>
              <p>
                <strong>Ana</strong> subió al 1.º puesto
              </p>
              <span>Hace 12 min · 91 puntos</span>
            </div>
            <span className={styles.activityArrow}>
              <ArrowIcon />
            </span>
          </div>
        </section>
      </div>
    </article>
  );
}
