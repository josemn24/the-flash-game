import type { Metadata } from "next";
import { Bricolage_Grotesque, Fredoka, IBM_Plex_Mono, Manrope } from "next/font/google";
import { LobbyConcept } from "../flash-pop-concepts/LobbyConcept";
import styles from "./FlashPopTypography.module.css";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: "variable",
  axes: ["opsz", "wdth"],
  variable: "--font-bricolage",
  display: "swap",
});

const fredoka = Fredoka({
  subsets: ["latin"],
  weight: "variable",
  axes: ["wdth"],
  variable: "--font-fredoka",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: "variable",
  variable: "--font-manrope",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["600", "700"],
  style: "normal",
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Flash Pop — Bricolage vs Fredoka",
  description:
    "Comparativa controlada de Bricolage Grotesque y Fredoka para la tipografía display de Flash Pop.",
};

const sharedConcept = {
  theme: "soft" as const,
  selected: false,
  art: "/flash-pop/concepts/pyramid-soft-diorama.webp",
  artAlt: "Diorama suave de una pirámide rodeada por energía amarilla",
};

export default function FlashPopTypographyPage() {
  return (
    <main
      className={`${styles.page} ${bricolage.variable} ${fredoka.variable} ${manrope.variable} ${plexMono.variable}`}
    >
      <header className={styles.pageHeader}>
        <p className={styles.kicker}>Flash Pop · Decisión tipográfica</p>
        <h1>Bricolage vs Fredoka</h1>
        <p>
          Dos lobbies Soft Diorama idénticos. Manrope se mantiene en la interfaz e IBM Plex Mono en
          datos; solo cambia la familia display.
        </p>
      </header>

      <section className={styles.comparisonGrid} aria-label="Comparativa tipográfica Flash Pop">
        <LobbyConcept
          {...sharedConcept}
          id="A"
          name="Bricolage Grotesque"
          summary="Display · peso 700"
          fontClassName={styles.bricolage}
        />
        <LobbyConcept
          {...sharedConcept}
          id="B"
          name="Fredoka"
          summary="Display · peso 700"
          fontClassName={styles.fredoka}
        />
      </section>

      <aside className={styles.controlNote}>
        <span>Control</span>
        <p>Mismo contenido · mismo viewport · mismos tamaños · mismos pesos · mismo tracking</p>
      </aside>
    </main>
  );
}
