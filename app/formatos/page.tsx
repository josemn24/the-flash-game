import type { Metadata } from "next";
import Link from "next/link";
import { ArrowIcon } from "@/components/icons";
import styles from "@/components/FormatLibrary.module.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SpeedBackground } from "@/components/SpeedBackground";
import { questionFormats } from "@/features/question-formats/catalog";

export const metadata: Metadata = {
  title: "Biblioteca de formatos — The Flash",
  description:
    "Reglas, puntuación y recomendaciones de los quince formatos de pregunta de The Flash.",
};

export default function FormatsPage() {
  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-[var(--ink)] text-white">
      <SpeedBackground />
      <div className={styles.page}>
        <SiteHeader />
        <header className="pt-16 sm:pt-24">
          <p className={styles.eyebrow}>Manual de juego · {questionFormats.length} formatos</p>
          <h1 className={styles.title}>Biblioteca de formatos</h1>
          <p className={styles.lead}>
            Una guía para entender cómo funciona cada tipo de pregunta, cuándo utilizarlo y cómo
            convierte precisión y velocidad en puntos.
          </p>
        </header>
        <div className={styles.grid}>
          {questionFormats.map((format, index) => (
            <Link key={format.id} className={styles.card} href={`/formatos/${format.slug}`}>
              <span className={styles.cardNumber}>{String(index + 1).padStart(2, "0")}</span>
              <h2>{format.name}</h2>
              <p>{format.summary}</p>
              <div className={styles.cardMeta}>
                <span>
                  {format.scoring.label}
                  <br />
                  {format.timing.recommendedSeconds}
                </span>
                <span>
                  Ver ficha <ArrowIcon className="inline h-4 w-4" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
