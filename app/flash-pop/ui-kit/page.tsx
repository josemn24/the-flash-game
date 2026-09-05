import type { CSSProperties } from "react";
import type { Metadata } from "next";
import {
  PopAvatar,
  PopAvatarStack,
  PopButton,
  PopButtonLink,
  PopCanvas,
  PopCard,
  PopChip,
  PopIconButton,
  PopTimerDisplay,
  type PopAvatarData,
} from "@/components/ui";
import { ArrowIcon, BellIcon, BoltIcon, CheckIcon, CrossIcon } from "@/components/icons";
import { LiveTimerDemo } from "./LiveTimerDemo.client";
import styles from "./UiKit.module.css";

export const metadata: Metadata = {
  title: "Flash Pop — UI Kit",
  description: "Laboratorio aislado de tokens, primitivas y estados de Flash Pop.",
};

const colors = [
  ["Canvas", "--pop-color-canvas", "#f4f1ea"],
  ["Surface", "--pop-color-surface", "#ffffff"],
  ["Raised", "--pop-color-surface-raised", "#fbfaf6"],
  ["Soft", "--pop-color-surface-soft", "#eae7ff"],
  ["Ink", "--pop-color-ink", "#171720"],
  ["Flash", "--pop-color-brand", "#d7ff19"],
  ["Social", "--pop-color-social", "#6957e8"],
  ["Success", "--pop-color-success", "#0f766e"],
  ["Danger", "--pop-color-danger", "#ff7276"],
  ["Info", "--pop-color-info", "#74a7f5"],
  ["Reward", "--pop-color-reward", "#ffd85a"],
] as const;

const radii = [
  ["Sm", "--pop-radius-sm", "12 px"],
  ["Control", "--pop-radius-control", "18 px"],
  ["Card", "--pop-radius-card", "24 px"],
  ["Hero", "--pop-radius-hero", "30 px"],
  ["Pill", "--pop-radius-pill", "999 px"],
] as const;

const elevations = [
  ["Control", "--pop-shadow-control"],
  ["Card", "--pop-shadow-card"],
  ["Hero", "--pop-shadow-hero"],
] as const;

const players: PopAvatarData[] = [
  { id: "ana", name: "Ana Moreno", initials: "AM", tone: "coral" },
  { id: "luis", name: "Luis Úbeda", initials: "LU", tone: "blue" },
  { id: "rocio", name: "Rocío", tone: "aqua" },
  { id: "joel", name: "Joel", tone: "ink" },
  { id: "marta", name: "Marta", tone: "reward" },
  { id: "ines", name: "Inés", tone: "social" },
];

function SectionHeading({
  id,
  eyebrow,
  children,
}: {
  id: string;
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <header className={styles.sectionHeading}>
      <p>{eyebrow}</p>
      <h2 id={id}>{children}</h2>
    </header>
  );
}

export default function FlashPopUiKitPage() {
  return (
    <PopCanvas maxWidth="content" contentClassName={styles.page}>
      <header className={styles.hero}>
        <PopChip tone="social">Laboratorio aislado</PopChip>
        <h1>Flash Pop UI Kit</h1>
        <p>
          Tokens, primitivas y estados aprobados para el vertical slice. Usa Tab para comprobar el
          foco y activa reducción de movimiento para validar la alternativa estática.
        </p>
      </header>

      <section className={styles.section} aria-labelledby="tokens-title">
        <SectionHeading id="tokens-title" eyebrow="01 · Fundamentos">
          Color y tipografía
        </SectionHeading>
        <div className={styles.swatchGrid}>
          {colors.map(([name, token, value]) => (
            <PopCard key={token} padding="compact" elevation="flat" className={styles.swatchCard}>
              <span
                className={styles.swatch}
                style={{ "--swatch-color": `var(${token})` } as CSSProperties}
              />
              <span>
                <strong>{name}</strong>
                <small>{value}</small>
              </span>
            </PopCard>
          ))}
        </div>
        <PopCard className={styles.typeSpecimen}>
          <p className={styles.displayType}>Hoy toca subir.</p>
          <p className={styles.uiType}>
            Manrope mantiene clara la interfaz incluso cuando aumenta la densidad de información.
          </p>
          <p className={styles.monoType}>02:14 · 680 / 900 ⚡ · NIVEL 4</p>
        </PopCard>
        <div className={styles.foundationGrid}>
          <PopCard elevation="flat" className={styles.tokenPanel}>
            <h3>Radios</h3>
            <div className={styles.radiusSpecimens}>
              {radii.map(([name, token, value]) => (
                <span key={token}>
                  <i
                    className={styles.radiusShape}
                    style={{ "--sample-radius": `var(${token})` } as CSSProperties}
                  />
                  <strong>{name}</strong>
                  <small>{value}</small>
                </span>
              ))}
            </div>
          </PopCard>
          <PopCard elevation="flat" className={styles.tokenPanel}>
            <h3>Elevación</h3>
            <div className={styles.elevationSpecimens}>
              {elevations.map(([name, token]) => (
                <span key={token}>
                  <i
                    className={styles.elevationShape}
                    style={{ "--sample-shadow": `var(${token})` } as CSSProperties}
                  />
                  <strong>{name}</strong>
                </span>
              ))}
            </div>
          </PopCard>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="buttons-title">
        <SectionHeading id="buttons-title" eyebrow="02 · Controles">
          Botones
        </SectionHeading>
        <PopCard>
          <div className={styles.controlGrid}>
            <div>
              <small>Primary</small>
              <PopButton trailingIcon={<ArrowIcon />}>Jugar ahora</PopButton>
            </div>
            <div>
              <small>Secondary</small>
              <PopButton variant="secondary" leadingIcon={<BoltIcon />}>
                Ver progreso
              </PopButton>
            </div>
            <div>
              <small>Hero link</small>
              <PopButtonLink href="/flash-pop" size="hero" trailingIcon={<ArrowIcon />}>
                Volver al lobby
              </PopButtonLink>
            </div>
            <div>
              <small>Loading</small>
              <PopButton loading>Guardando</PopButton>
            </div>
            <div>
              <small>Disabled</small>
              <PopButton disabled>Reto cerrado</PopButton>
            </div>
            <div>
              <small>Icon buttons</small>
              <span className={styles.inlineControls}>
                <PopIconButton label="Notificaciones">
                  <BellIcon />
                </PopIconButton>
                <PopIconButton label="Progreso social" variant="social">
                  <BoltIcon />
                </PopIconButton>
              </span>
            </div>
          </div>
          <PopButton fullWidth className={styles.longButton}>
            Continuar con este texto deliberadamente más largo
          </PopButton>
        </PopCard>
      </section>

      <section className={styles.section} aria-labelledby="chips-title">
        <SectionHeading id="chips-title" eyebrow="03 · Metadatos">
          Chips
        </SectionHeading>
        <PopCard>
          <div className={styles.chipRow}>
            <PopChip>Disponible</PopChip>
            <PopChip tone="social">Nuevo</PopChip>
            <PopChip tone="info">En progreso</PopChip>
            <PopChip tone="success" icon={<CheckIcon />}>
              Completado
            </PopChip>
            <PopChip tone="danger" icon={<CrossIcon />}>
              Cerrado
            </PopChip>
            <PopChip variant="data">2 h 14 min</PopChip>
            <PopChip variant="reward">Hasta +120 ⚡</PopChip>
          </div>
        </PopCard>
      </section>

      <section className={styles.section} aria-labelledby="avatars-title">
        <SectionHeading id="avatars-title" eyebrow="04 · Presencia">
          Avatares
        </SectionHeading>
        <PopCard>
          <div className={styles.avatarExamples}>
            <PopAvatar name="Javi Moreno" size="lg" />
            <PopAvatar name="Ana Moreno" tone="coral" />
            <PopAvatar name="Luis Úbeda" tone="blue" />
            <PopAvatar name="Rocío" tone="aqua" />
            <PopAvatar name="Jugador destacado" initials="01" tone="reward" />
          </div>
          <div className={styles.stackExamples}>
            <PopAvatarStack items={players.slice(0, 2)} label="2 ya jugaron" />
            <PopAvatarStack items={players} maxVisible={4} label="6 ya jugaron" />
          </div>
        </PopCard>
      </section>

      <section className={styles.section} aria-labelledby="cards-title">
        <SectionHeading id="cards-title" eyebrow="05 · Superficies">
          Cards
        </SectionHeading>
        <div className={styles.cardGrid}>
          <PopCard elevation="flat">
            <strong>Flat surface</strong>
            <p>Para elementos contenidos que no necesitan profundidad adicional.</p>
          </PopCard>
          <PopCard>
            <strong>Card elevation</strong>
            <p>Superficie estándar para progreso y actividad.</p>
          </PopCard>
          <PopCard surface="soft" elevation="hero">
            <strong>Soft hero</strong>
            <p>Máxima jerarquía sin abandonar la paleta clara.</p>
          </PopCard>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="timer-title">
        <SectionHeading id="timer-title" eyebrow="06 · Tiempo">
          Timer
        </SectionHeading>
        <PopCard>
          <div className={styles.timerStates}>
            <span>
              <PopTimerDisplay duration={20} remaining={14} />
              <small>Normal</small>
            </span>
            <span>
              <PopTimerDisplay duration={20} remaining={4} />
              <small>Urgente</small>
            </span>
            <span>
              <PopTimerDisplay duration={20} remaining={0} />
              <small>Finalizado</small>
            </span>
            <span>
              <PopTimerDisplay duration={20} remaining={20} size="compact" />
              <small>Compacto</small>
            </span>
          </div>
          <LiveTimerDemo />
        </PopCard>
      </section>
    </PopCanvas>
  );
}
