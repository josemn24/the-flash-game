"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Card, Chip } from "@/components/ui";
import type { SuperadminQuestionLibraryContext } from "@/types/view-models/editorial";
import styles from "./QuestionLibraryManagement.module.css";

const statusLabels = { draft: "Borrador", published: "Publicado", archived: "Archivado" } as const;

export function QuestionLibraryManagement({
  library,
}: {
  readonly library: SuperadminQuestionLibraryContext;
}) {
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [tag, setTag] = useState("");
  const entries = useMemo(
    () =>
      library.entries.filter(
        (entry) =>
          (type === "all" || entry.type === type) &&
          (status === "all" || entry.status === status) &&
          (!search ||
            `${entry.slug} ${entry.question}`
              .toLocaleLowerCase()
              .includes(search.toLocaleLowerCase())) &&
          (!tag ||
            JSON.stringify(entry.tags).toLocaleLowerCase().includes(tag.toLocaleLowerCase())),
      ),
    [library.entries, search, status, tag, type],
  );

  return (
    <section className={styles.section} aria-labelledby="question-library-title">
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>S17a · biblioteca editorial</p>
          <h2 id="question-library-title">Preguntas reutilizables</h2>
        </div>
        <Link className={styles.linkButton} href="/admin/questions/new">
          Nueva pregunta
        </Link>
      </div>
      <p className={styles.description}>
        Las versiones publicadas son inmutables. Los desafíos seleccionan una versión exacta y
        asignan sus propios puntos.
      </p>
      <Card as="section" className={styles.filters} aria-label="Filtros de preguntas">
        <label>
          <span>Buscar</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Slug o enunciado"
          />
        </label>
        <label>
          <span>Formato</span>
          <select value={type} onChange={(event) => setType(event.target.value)}>
            <option value="all">Todos</option>
            <option value="multiple-choice">Multiple choice</option>
            <option value="estimation">Estimation</option>
            <option value="heat-map">Heat map</option>
            <option value="mini-wordle">Mini Wordle</option>
            <option value="logic-code">Logic code</option>
            <option value="progressive-clues">Progressive clues</option>
            <option value="matching">Matching</option>
            <option value="true-false">True / False</option>
            <option value="odd-one-out">Odd one out</option>
            <option value="ordering">Ordering</option>
            <option value="anagram">Anagram</option>
            <option value="classification">Classification</option>
            <option value="progressive-image">Progressive image</option>
          </select>
        </label>
        <label>
          <span>Estado</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">Todos</option>
            <option value="published">Publicadas</option>
            <option value="draft">Borradores</option>
            <option value="archived">Archivadas</option>
          </select>
        </label>
        <label>
          <span>Tag</span>
          <input value={tag} onChange={(event) => setTag(event.target.value)} placeholder="arte" />
        </label>
      </Card>
      <div className={styles.meta}>
        {entries.length} de {library.total} entradas · página {library.page}
      </div>
      <div className={styles.grid}>
        {entries.map((entry) => (
          <Link
            href={`/admin/questions/${entry.questionVersionId}`}
            key={entry.questionVersionId}
            className={styles.entryLink}
          >
            <Card as="article" surface="soft" className={styles.entry}>
              <div className={styles.entryTop}>
                <span className={styles.eyebrow}>{entry.type}</span>
                <Chip
                  variant="status"
                  tone={
                    entry.status === "published"
                      ? "success"
                      : entry.status === "draft"
                        ? "info"
                        : "neutral"
                  }
                >
                  {statusLabels[entry.status]}
                </Chip>
              </div>
              <h3>{entry.slug}</h3>
              <p>{entry.question}</p>
              <span className={styles.entryMeta}>
                v{entry.versionNumber} · {entry.timeLimitMs / 1000}s · {entry.versionCount}{" "}
                versiones · {entry.usageCount} usos
              </span>
            </Card>
          </Link>
        ))}
      </div>
      {entries.length === 0 ? (
        <Card surface="soft" className={styles.empty}>
          <p>No hay preguntas que coincidan con los filtros.</p>
        </Card>
      ) : null}
    </section>
  );
}
