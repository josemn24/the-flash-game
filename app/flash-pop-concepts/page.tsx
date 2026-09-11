import type { Metadata } from "next";
import styles from "./FlashPopConcepts.module.css";
import { LobbyConcept } from "./LobbyConcept";

export const metadata: Metadata = {
  title: "Flash Pop — Arte de formatos",
  description: "Una dirección visual para cada formato de Flash Pop.",
};

const concepts = [
  {
    id: "01",
    name: "Flash",
    summary: "Velocidad, reflejos y respuesta inmediata",
    theme: "graphic",
    selected: false,
    art: "/flash-pop/concepts/flash-floating-cards.webp",
    artAlt: "Tarjetas de colores y un reloj atravesados por un rayo amarillo",
    heroTitle: "Flash",
    heroSubtitle: "Responde antes de que se escape",
  },
  {
    id: "02",
    name: "Alfabeto",
    summary: "Recorrido, variedad y una cuenta atrás",
    theme: "soft",
    selected: false,
    art: "/flash-pop/concepts/alphabet-letter-path.webp",
    artAlt: "Camino curvo de fichas de colores con una ficha brillante pendiente",
    heroTitle: "Alfabeto",
    heroSubtitle: "Una letra, una respuesta",
  },
  {
    id: "03",
    name: "Supervivencia",
    summary: "Resistencia, tensión y vidas limitadas",
    theme: "arena",
    selected: false,
    art: "/flash-pop/concepts/survival-last-beacon.webp",
    artAlt: "Faro luminoso sobre una isla rodeada de olas y tres luces",
    heroTitle: "Supervivencia",
    heroSubtitle: "Conserva tus tres vidas",
  },
  {
    id: "04",
    name: "Narrativa",
    summary: "Historias, escenas y decisiones",
    theme: "soft",
    selected: false,
    art: "/flash-pop/concepts/narrative-story-trail.webp",
    artAlt: "Libro abierto convertido en un paisaje atravesado por un camino luminoso",
    heroTitle: "Narrativa",
    heroSubtitle: "Cada respuesta abre una escena",
  },
  {
    id: "05",
    name: "La Pirámide",
    summary: "Una única imagen para el formato de ascenso",
    theme: "soft",
    selected: true,
    art: "/flash-pop/concepts/pyramid-soft-diorama.webp",
    artAlt: "Diorama suave de una pirámide rodeada por energía amarilla",
    heroTitle: "La Pirámide",
    heroSubtitle: "¿Hasta dónde puedes subir?",
  },
] as const;

export default function FlashPopConceptsPage() {
  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <p className={styles.kicker}>Flash Pop · Fase visual</p>
        <h1>Un arte para cada formato</h1>
        <p>
          La misma familia visual acompaña cada forma de jugar. La Pirámide conserva una única
          imagen; los demás formatos tienen un símbolo propio y reconocible.
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
