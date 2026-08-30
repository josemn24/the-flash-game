import type { Metadata } from "next";
import styles from "./FlashPopConcepts.module.css";
import { LobbyConcept } from "./LobbyConcept";

export const metadata: Metadata = {
  title: "Flash Pop — Direcciones de lobby",
  description: "Tres propuestas comparables para la dirección visual de Flash Pop.",
};

const concepts = [
  {
    id: "A",
    name: "Graphic Voltage",
    summary: "Más editorial, nítida y propia",
    theme: "graphic",
    selected: false,
    art: "/flash-pop/concepts/pyramid-graphic-voltage.webp",
    artAlt: "Torre geométrica atravesada por un rayo amarillo",
  },
  {
    id: "B",
    name: "Soft Diorama",
    summary: "Más cálida, social y cercana a Playus",
    theme: "soft",
    selected: true,
    art: "/flash-pop/concepts/pyramid-soft-diorama.webp",
    artAlt: "Diorama suave de una pirámide rodeada por energía amarilla",
  },
  {
    id: "C",
    name: "Electric Arena",
    summary: "Más competitiva, intensa y arcade",
    theme: "arena",
    selected: false,
    art: "/flash-pop/concepts/pyramid-electric-arena.webp",
    artAlt: "Pirámide de arena oscura abierta por un rayo amarillo",
  },
] as const;

export default function FlashPopConceptsPage() {
  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <p className={styles.kicker}>Flash Pop · Fase visual</p>
        <h1>Tres direcciones, el mismo lobby</h1>
        <p>
          El contenido, la jerarquía y el viewport son idénticos. Solo cambian la expresión gráfica,
          la profundidad y la intensidad competitiva.
        </p>
      </header>

      <section className={styles.conceptGrid} aria-label="Direcciones visuales Flash Pop">
        {concepts.map((concept) => (
          <LobbyConcept {...concept} key={concept.id} />
        ))}
      </section>
    </main>
  );
}
