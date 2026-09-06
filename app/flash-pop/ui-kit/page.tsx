import type { CSSProperties } from "react";
import type { Metadata } from "next";
import {
  Avatar,
  AvatarStack,
  Button,
  ButtonLink,
  Canvas,
  Card,
  Chip,
  IconButton,
  TimerDisplay,
  type AvatarData,
} from "@/components/ui";
import { ArrowIcon, BellIcon, BoltIcon, CheckIcon, CrossIcon } from "@/components/ui";
import { LiveTimerDemo } from "./LiveTimerDemo.client";
import styles from "./UiKit.module.css";

export const metadata: Metadata = {
  title: "Flash Pop — UI Kit",
  description: "Laboratorio aislado de tokens, primitivas y estados de Flash Pop.",
};

const colors = [
  ["Canvas", "--color-canvas", "#f4f1ea"],
  ["Surface", "--color-surface", "#ffffff"],
  ["Raised", "--color-surface-raised", "#fbfaf6"],
  ["Soft", "--color-surface-soft", "#eae7ff"],
  ["Ink", "--color-ink", "#171720"],
  ["Flash", "--color-brand", "#d7ff19"],
  ["Social", "--color-social", "#6957e8"],
  ["Success", "--color-success", "#0f766e"],
  ["Danger", "--color-danger", "#ff7276"],
  ["Info", "--color-info", "#74a7f5"],
  ["Reward", "--color-reward", "#ffd85a"],
] as const;

const radii = [
  ["Sm", "--radius-sm", "8 px"],
  ["Control", "--radius-control", "10 px"],
  ["Card", "--radius-card", "14 px"],
  ["Hero", "--radius-hero", "0 px"],
  ["Pill", "--radius-pill", "999 px"],
] as const;

const elevations = [
  ["Control", "--shadow-control"],
  ["Card", "--shadow-card"],
  ["Hero", "--shadow-hero"],
] as const;

const players: AvatarData[] = [
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
    <Canvas maxWidth="content" contentClassName={styles.page}>
      <header className={styles.hero}>
        <Chip tone="social">Laboratorio aislado</Chip>
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
            <Card key={token} padding="compact" elevation="flat" className={styles.swatchCard}>
              <span
                className={styles.swatch}
                style={{ "--swatch-color": `var(${token})` } as CSSProperties}
              />
              <span>
                <strong>{name}</strong>
                <small>{value}</small>
              </span>
            </Card>
          ))}
        </div>
        <Card className={styles.typeSpecimen}>
          <p className={styles.displayType}>Hoy toca subir.</p>
          <p className={styles.uiType}>
            Manrope mantiene clara la interfaz incluso cuando aumenta la densidad de información.
          </p>
          <p className={styles.monoType}>02:14 · 680 / 900 ⚡ · NIVEL 4</p>
        </Card>
        <div className={styles.foundationGrid}>
          <Card elevation="flat" className={styles.tokenPanel}>
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
          </Card>
          <Card elevation="flat" className={styles.tokenPanel}>
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
          </Card>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="buttons-title">
        <SectionHeading id="buttons-title" eyebrow="02 · Controles">
          Botones
        </SectionHeading>
        <Card>
          <div className={styles.controlGrid}>
            <div>
              <small>Primary</small>
              <Button trailingIcon={<ArrowIcon />}>Jugar ahora</Button>
            </div>
            <div>
              <small>Secondary</small>
              <Button variant="secondary" leadingIcon={<BoltIcon />}>
                Ver progreso
              </Button>
            </div>
            <div>
              <small>Hero link</small>
              <ButtonLink href="/flash-pop" size="hero" trailingIcon={<ArrowIcon />}>
                Volver al lobby
              </ButtonLink>
            </div>
            <div>
              <small>Loading</small>
              <Button loading>Guardando</Button>
            </div>
            <div>
              <small>Disabled</small>
              <Button disabled>Reto cerrado</Button>
            </div>
            <div>
              <small>Icon buttons</small>
              <span className={styles.inlineControls}>
                <IconButton label="Notificaciones">
                  <BellIcon />
                </IconButton>
                <IconButton label="Progreso social" variant="social">
                  <BoltIcon />
                </IconButton>
              </span>
            </div>
          </div>
          <Button fullWidth className={styles.longButton}>
            Continuar con este texto deliberadamente más largo
          </Button>
        </Card>
      </section>

      <section className={styles.section} aria-labelledby="chips-title">
        <SectionHeading id="chips-title" eyebrow="03 · Metadatos">
          Chips
        </SectionHeading>
        <Card>
          <div className={styles.chipRow}>
            <Chip>Disponible</Chip>
            <Chip tone="social">Nuevo</Chip>
            <Chip tone="info">En progreso</Chip>
            <Chip tone="success" icon={<CheckIcon />}>
              Completado
            </Chip>
            <Chip tone="danger" icon={<CrossIcon />}>
              Cerrado
            </Chip>
            <Chip variant="data">2 h 14 min</Chip>
            <Chip variant="reward">Hasta +120 ⚡</Chip>
          </div>
        </Card>
      </section>

      <section className={styles.section} aria-labelledby="avatars-title">
        <SectionHeading id="avatars-title" eyebrow="04 · Presencia">
          Avatares
        </SectionHeading>
        <Card>
          <div className={styles.avatarExamples}>
            <Avatar name="Javi Moreno" size="lg" />
            <Avatar name="Ana Moreno" tone="coral" />
            <Avatar name="Luis Úbeda" tone="blue" />
            <Avatar name="Rocío" tone="aqua" />
            <Avatar name="Jugador destacado" initials="01" tone="reward" />
          </div>
          <div className={styles.stackExamples}>
            <AvatarStack items={players.slice(0, 2)} label="2 ya jugaron" />
            <AvatarStack items={players} maxVisible={4} label="6 ya jugaron" />
          </div>
        </Card>
      </section>

      <section className={styles.section} aria-labelledby="cards-title">
        <SectionHeading id="cards-title" eyebrow="05 · Superficies">
          Cards
        </SectionHeading>
        <div className={styles.cardGrid}>
          <Card elevation="flat">
            <strong>Flat surface</strong>
            <p>Para elementos contenidos que no necesitan profundidad adicional.</p>
          </Card>
          <Card>
            <strong>Card elevation</strong>
            <p>Superficie estándar para progreso y actividad.</p>
          </Card>
          <Card surface="soft" elevation="hero">
            <strong>Soft hero</strong>
            <p>Máxima jerarquía sin abandonar la paleta clara.</p>
          </Card>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="timer-title">
        <SectionHeading id="timer-title" eyebrow="06 · Tiempo">
          Timer
        </SectionHeading>
        <Card>
          <div className={styles.timerStates}>
            <span>
              <TimerDisplay duration={20} remaining={14} />
              <small>Normal</small>
            </span>
            <span>
              <TimerDisplay duration={20} remaining={4} />
              <small>Urgente</small>
            </span>
            <span>
              <TimerDisplay duration={20} remaining={0} />
              <small>Finalizado</small>
            </span>
            <span>
              <TimerDisplay duration={20} remaining={20} size="compact" />
              <small>Compacto</small>
            </span>
          </div>
          <LiveTimerDemo />
        </Card>
      </section>
    </Canvas>
  );
}
