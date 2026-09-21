import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import styles from "@/components/library/FormatLibrary.module.css";
import { PlayableFormatExample } from "@/components/game";
import { SiteHeader } from "@/components/navigation";
import { SpeedBackground } from "@/components/effects";
import { getQuestionFormatBySlug, questionFormats } from "@/features/question-formats/catalog";

type Props = { params: Promise<{ slug: string }> };
export const dynamicParams = false;

export function generateStaticParams() {
  return questionFormats.map((format) => ({ slug: format.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const format = getQuestionFormatBySlug((await params).slug);
  return format
    ? { title: `${format.name} — Biblioteca The Flash`, description: format.summary }
    : { title: "Formato no encontrado — The Flash" };
}

function ListSection({
  title,
  items,
  className = "",
}: {
  title: string;
  items: string[];
  className?: string;
}) {
  return (
    <section className={`${styles.section} ${className}`}>
      <h2>{title}</h2>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

export default async function FormatDetailPage({ params }: Props) {
  const format = getQuestionFormatBySlug((await params).slug);
  if (!format) notFound();
  const index = questionFormats.findIndex((item) => item.id === format.id);
  const previous = questionFormats[(index - 1 + questionFormats.length) % questionFormats.length];
  const next = questionFormats[(index + 1) % questionFormats.length];

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-[var(--color-canvas)] text-[var(--color-ink)]">
      <SpeedBackground />
      <div className={styles.page}>
        <SiteHeader />
        <header className={styles.detailHero}>
          <span className={styles.detailIndex}>{String(index + 1).padStart(2, "0")}</span>
          <div>
            <p className={styles.eyebrow}>Formato de pregunta</p>
            <h1 className={styles.detailTitle}>{format.name}</h1>
            <p className={styles.detailSummary}>{format.summary}</p>
          </div>
        </header>

        <div className={styles.contentGrid}>
          <section className={`${styles.section} ${styles.wide}`}>
            <h2>En qué consiste</h2>
            {format.description.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </section>
          <ListSection
            title="Cuándo utilizarlo"
            items={format.recommendations}
            className={styles.sectionGood}
          />
          <ListSection
            title="Cuándo evitarlo"
            items={format.avoidWhen}
            className={styles.sectionAvoid}
          />
          <ListSection title="Reglas" items={format.rules} />
          <section className={`${styles.section} ${styles.scoringPanel}`}>
            <h2>{format.scoring.label}</h2>
            <p>{format.scoring.summary}</p>
            <div className={styles.scoringFlags}>
              <span>
                {("partialCreditLabel" in format.scoring
                  ? format.scoring.partialCreditLabel
                  : undefined) ??
                  (format.scoring.partialCredit ? "Crédito parcial" : "Todo o nada")}
              </span>
              <span>{format.scoring.speedBonus ? "Premia velocidad" : "Sin bonus de tiempo"}</span>
              <span>
                {("incorrectPenaltyLabel" in format.scoring
                  ? format.scoring.incorrectPenaltyLabel
                  : undefined) ??
                  (format.scoring.incorrectPenalty ? "Penaliza fallos" : "Sin penalización")}
              </span>
            </div>
          </section>
          <ListSection title="Consejos de redacción" items={format.authoringTips} />
          <ListSection title="Accesibilidad" items={format.accessibility} />
          <section className={styles.section}>
            <h2>Tiempo recomendado</h2>
            <p>
              <strong className={styles.timingValue}>{format.timing.recommendedSeconds}</strong>
            </p>
            <p>{format.timing.notes}</p>
          </section>
          <section className={styles.section}>
            <h2>Contenido compatible</h2>
            <ul>
              {format.mediaSupport.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
          <section className={styles.wide}>
            <p className={`${styles.eyebrow} mb-3`}>Ejemplos jugables</p>
            <div className={styles.examplesGrid}>
              {format.examples.map((example) => (
                <PlayableFormatExample
                  key={example.question.id}
                  title={example.title}
                  question={example.question}
                  rules={format.rules}
                />
              ))}
            </div>
          </section>
        </div>

        <nav className={styles.pager} aria-label="Formatos anterior y siguiente">
          <Link href={`/formatos/${previous.slug}`}>
            <span>
              <small>Anterior</small>
              <strong>← {previous.name}</strong>
            </span>
          </Link>
          <Link href={`/formatos/${next.slug}`}>
            <span>
              <small>Siguiente</small>
              <strong>{next.name} →</strong>
            </span>
          </Link>
        </nav>
      </div>
    </main>
  );
}
