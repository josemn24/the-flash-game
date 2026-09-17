"use client";

import { useActionState, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { AnswerOption } from "@/components/questions/shared/AnswerOption";
import { Button, Card, Chip } from "@/components/ui";
import {
  createFlashDraft,
  publishFlash,
  updateFlashDraft,
  type EditorialActionState,
} from "@/app/admin/editorial-actions";
import {
  FlashEditorialValidationError,
  formatFlashEditorialDocument,
  parseFlashEditorialJson,
} from "@/lib/editorial/flashDocument";
import type {
  FlashEditorialDocument,
  FlashEditorialMultipleChoiceQuestion,
  SuperadminEditorialContext,
} from "@/types/view-models/editorial";
import type { MultipleChoiceQuestion } from "@/types/question";
import styles from "./EditorialManagement.module.css";

const initialState: EditorialActionState = {};

const emptyDocument: FlashEditorialDocument = {
  challenge: {
    slug: "flash-nuevo-001",
    title: "Nuevo Flash",
    subtitle: "Dos preguntas",
    description: "Desafío Flash preparado desde el portal.",
    mode: "flash",
    configSchemaVersion: 1,
    modeConfig: {},
  },
  questions: [
    {
      slug: "pregunta-uno",
      type: "multiple-choice",
      payloadSchemaVersion: 1,
      timeLimitMs: 15000,
      points: 50,
      publicPayload: {
        category: "Cultura general",
        tags: {},
        question: "¿Cuál es la capital de Portugal?",
        options: ["Lisboa", "Oporto", "Braga"],
        media: null,
        promptVisual: null,
      },
      solutionPayload: {
        correctAnswer: "Lisboa",
        explanation: "Lisboa es la capital de Portugal.",
      },
    },
    {
      slug: "pregunta-dos",
      type: "multiple-choice",
      payloadSchemaVersion: 1,
      timeLimitMs: 15000,
      points: 50,
      publicPayload: {
        category: "Ciencia",
        tags: {},
        question: "¿Qué planeta es conocido como el planeta rojo?",
        options: ["Marte", "Venus", "Júpiter"],
        media: null,
        promptVisual: null,
      },
      solutionPayload: {
        correctAnswer: "Marte",
        explanation: "Marte recibe ese nombre por el color rojizo de su superficie.",
      },
    },
  ],
};

function newKey() {
  return globalThis.crypto.randomUUID();
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

function prepareKey(event: FormEvent<HTMLFormElement>, keyRef: { current: string | null }) {
  if (!keyRef.current) keyRef.current = newKey();
  const input = event.currentTarget.elements.namedItem("idempotencyKey");
  if (input instanceof HTMLInputElement) input.value = keyRef.current;
}

function useResetKeyWhenError(state: EditorialActionState, keyRef: { current: string | null }) {
  useEffect(() => {
    if (state.message) keyRef.current = null;
  }, [state.message, keyRef]);
}

function ErrorMessage({ state }: { readonly state: EditorialActionState }) {
  if (!state.message) return null;
  const details = [...new Set(
    Object.entries(state.fieldErrors ?? {})
      .filter(([key]) => key !== "form")
      .map(([, message]) => message),
  )];
  return (
    <p className={styles.error} role="alert">
      {state.message}{details.length > 0 ? ` ${details.join(" ")}` : ""}
    </p>
  );
}

function statusLabel(status: SuperadminEditorialContext["entries"][number]["status"]) {
  if (status === "draft") return "Borrador";
  if (status === "published") return "Publicado";
  return "Archivado";
}

function statusTone(status: SuperadminEditorialContext["entries"][number]["status"]) {
  if (status === "draft") return "info" as const;
  if (status === "published") return "success" as const;
  return "neutral" as const;
}

function previewQuestion(question: FlashEditorialMultipleChoiceQuestion): MultipleChoiceQuestion {
  const tags = question.publicPayload.tags;
  return {
    id: question.slug,
    type: "multiple-choice",
    category: question.publicPayload.category ?? "",
    tags: {
      domains: Array.isArray(tags?.domains) ? tags.domains : [],
      topics: Array.isArray(tags?.topics) ? tags.topics : [],
      cognitiveSkills: Array.isArray(tags?.cognitiveSkills) ? tags.cognitiveSkills : [],
      formatSkills: Array.isArray(tags?.formatSkills) ? tags.formatSkills : [],
      lifeSkills: Array.isArray(tags?.lifeSkills) ? tags.lifeSkills : [],
    } as MultipleChoiceQuestion["tags"],
    question: question.publicPayload.question,
    options: [...question.publicPayload.options],
    correctAnswer: question.solutionPayload.correctAnswer,
    timeLimit: question.timeLimitMs / 1000,
    points: question.points,
    explanation: question.solutionPayload.explanation ?? "",
    ...(question.publicPayload.media ? { media: question.publicPayload.media } : {}),
    ...(question.publicPayload.promptVisual ? { promptVisual: question.publicPayload.promptVisual } : {}),
  };
}

function EditorialPreview({ document }: { readonly document: FlashEditorialDocument }) {
  return (
    <div className={styles.preview} aria-label="Previsualización editorial protegida">
      <div className={styles.previewHeading}>
        <div>
          <p className={styles.eyebrow}>Preview protegido</p>
          <h3>{document.challenge.title}</h3>
        </div>
        <Chip variant="data" tone="neutral">
          Sin intento ni puntuación
        </Chip>
      </div>
      <p className={styles.previewDescription}>{document.challenge.description}</p>
      <div className={styles.previewQuestions}>
        {document.questions.map((draftQuestion, index) => {
          if (draftQuestion.type === "mini-wordle") {
            const payload = draftQuestion.publicPayload;
            const solution = draftQuestion.solutionPayload;
            return (
              <article className={styles.previewQuestion} key={draftQuestion.slug}>
                <div className={styles.previewQuestionTopline}>
                  <span className={styles.eyebrow}>Pregunta {String(index + 1).padStart(2, "0")}</span>
                  <span className={styles.previewMeta}>{draftQuestion.timeLimitMs / 1000}s · {draftQuestion.points} puntos</span>
                </div>
                <p className={styles.category}>{payload.category ?? ""}</p>
                <h4>{payload.question}</h4>
                <p>{payload.hint ?? "Sin pista"} · {payload.wordLength} letras · {payload.maxAttempts} intentos</p>
                <p className={styles.solution}>
                  Solución privada: <strong>{solution.correctAnswer}</strong>
                </p>
              </article>
            );
          }
          const question = previewQuestion(draftQuestion);
          return (
            <article className={styles.previewQuestion} key={draftQuestion.slug}>
              <div className={styles.previewQuestionTopline}>
                <span className={styles.eyebrow}>Pregunta {String(index + 1).padStart(2, "0")}</span>
                <span className={styles.previewMeta}>{question.timeLimit}s · {question.points} puntos</span>
              </div>
              <p className={styles.category}>{question.category}</p>
              <h4>{question.question}</h4>
              <div className={styles.options}>
                {question.options.map((option, optionIndex) => (
                  <AnswerOption
                    key={option}
                    label={option}
                    index={optionIndex}
                    disabled
                    onSelect={() => undefined}
                  />
                ))}
              </div>
              <p className={styles.solution}>
                Solución privada: <strong>{question.correctAnswer}</strong>
              </p>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function ReasonField() {
  return (
    <label className={styles.field}>
      <span>Motivo de auditoría</span>
      <textarea name="reason" maxLength={500} rows={2} required placeholder="Preparar contenido de la beta" />
    </label>
  );
}

export function EditorialManagement({
  context,
}: {
  readonly context: SuperadminEditorialContext;
}) {
  const drafts = context.entries.filter((entry) => entry.status === "draft");
  const [selectedId, setSelectedId] = useState(drafts[0]?.challengeVersionId ?? "");
  const selected = drafts.find((entry) => entry.challengeVersionId === selectedId) ?? null;
  const [documentText, setDocumentText] = useState(
    selected?.document ? formatFlashEditorialDocument(selected.document) : formatFlashEditorialDocument(emptyDocument),
  );
  const [previewError, setPreviewError] = useState("");
  const [createState, createAction, createPending] = useActionState(createFlashDraft, initialState);
  const [updateState, updateAction, updatePending] = useActionState(updateFlashDraft, initialState);
  const [publishState, publishAction, publishPending] = useActionState(publishFlash, initialState);
  const createKeyRef = useRef<string | null>(null);
  const updateKeyRef = useRef<string | null>(null);
  const publishKeyRef = useRef<string | null>(null);
  useResetKeyWhenError(createState, createKeyRef);
  useResetKeyWhenError(updateState, updateKeyRef);
  useResetKeyWhenError(publishState, publishKeyRef);

  const parsedDocument = useMemo(() => {
    try {
      return parseFlashEditorialJson(documentText);
    } catch (error) {
      return error instanceof FlashEditorialValidationError ? null : null;
    }
  }, [documentText]);

  function validatePreview() {
    try {
      parseFlashEditorialJson(documentText);
      setPreviewError("");
    } catch (error) {
      setPreviewError(
        error instanceof FlashEditorialValidationError
          ? error.issues[0] ?? "El JSON no cumple el contrato editorial."
          : "El documento no contiene JSON válido.",
      );
    }
  }

  function selectDraft(event: ChangeEvent<HTMLSelectElement>) {
    const nextId = event.target.value;
    const nextDraft = drafts.find((entry) => entry.challengeVersionId === nextId);
    setSelectedId(nextId);
    setDocumentText(nextDraft?.document ? formatFlashEditorialDocument(nextDraft.document) : formatFlashEditorialDocument(emptyDocument));
    setPreviewError("");
  }

  function startNewDraft() {
    setSelectedId("");
    setDocumentText(formatFlashEditorialDocument(emptyDocument));
    setPreviewError("");
  }

  return (
    <section className={styles.section} aria-labelledby="editorial-management-title">
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.eyebrow}>S11 · herramienta editorial</p>
          <h2 id="editorial-management-title">Contenido Flash</h2>
        </div>
        <Chip variant="data" tone="social">{context.entries.length} versiones</Chip>
      </div>

      <div className={styles.layout}>
        <Card as="section" className={styles.editorCard} aria-labelledby="editorial-editor-title">
          <div className={styles.formHeading}>
            <div>
              <p className={styles.eyebrow}>JSON estructurado</p>
              <h3 id="editorial-editor-title">{selected ? "Editar borrador" : "Preparar contenido"}</h3>
            </div>
            <span className={styles.helper}>
              {selected ? `Actualizado ${formatTimestamp(selected.updatedAt)} UTC` : "Flash · 2 preguntas · 100 puntos"}
            </span>
          </div>

          {drafts.length > 0 ? (
            <div className={styles.draftSelector}>
              <label className={styles.field}>
                <span>Borrador</span>
                <select value={selectedId} onChange={selectDraft}>
                  {drafts.map((entry) => <option key={entry.challengeVersionId} value={entry.challengeVersionId}>{entry.title} · {entry.slug}</option>)}
                </select>
              </label>
              <Button type="button" variant="secondary" onClick={startNewDraft}>Nuevo borrador</Button>
            </div>
          ) : null}

          <label className={styles.field}>
            <span>Documento editorial</span>
            <textarea
              name="document"
              value={documentText}
              onChange={(event) => setDocumentText(event.currentTarget.value)}
              rows={24}
              spellCheck={false}
              aria-label="Documento editorial JSON"
            />
          </label>

          <div className={styles.actions}>
            {selected ? (
              <form action={updateAction} onSubmit={(event) => prepareKey(event, updateKeyRef)}>
                <input type="hidden" name="idempotencyKey" defaultValue="" />
                <input type="hidden" name="challengeVersionId" value={selected.challengeVersionId} readOnly />
                <input type="hidden" name="expectedUpdatedAt" value={selected.updatedAt} readOnly />
                <input type="hidden" name="document" value={documentText} readOnly />
                <ReasonField />
                <ErrorMessage state={updateState} />
                <Button type="submit" variant="secondary" loading={updatePending}>Guardar borrador</Button>
              </form>
            ) : (
              <form action={createAction} onSubmit={(event) => prepareKey(event, createKeyRef)}>
                <input type="hidden" name="idempotencyKey" defaultValue="" />
                <input type="hidden" name="document" value={documentText} readOnly />
                <ReasonField />
                <ErrorMessage state={createState} />
                <Button type="submit" loading={createPending}>Guardar borrador</Button>
              </form>
            )}
            <Button type="button" variant="secondary" onClick={validatePreview}>Validar y previsualizar</Button>
          </div>
          {previewError ? <p className={styles.error} role="alert">{previewError}</p> : null}

          {selected ? (
            <form
              action={publishAction}
              className={styles.publishForm}
              onSubmit={(event) => {
                if (!window.confirm(`¿Publicar «${selected.title}»? Después no podrá editarse.`)) {
                  event.preventDefault();
                  return;
                }
                prepareKey(event, publishKeyRef);
              }}
            >
              <input type="hidden" name="idempotencyKey" defaultValue="" />
              <input type="hidden" name="challengeVersionId" value={selected.challengeVersionId} readOnly />
              <input type="hidden" name="expectedUpdatedAt" value={selected.updatedAt} readOnly />
              <ReasonField />
              <ErrorMessage state={publishState} />
              <Button type="submit" loading={publishPending}>Publicar versión</Button>
            </form>
          ) : null}
        </Card>

        <div className={styles.previewColumn}>
          {parsedDocument ? <EditorialPreview document={parsedDocument} /> : <Card surface="soft" className={styles.emptyPreview}><p className={styles.eyebrow}>Preview protegido</p><h3>Corrige el JSON para ver el desafío.</h3><p>La validación se ejecuta también en el servidor antes de persistir.</p></Card>}
        </div>
      </div>

      <div className={styles.published}>
        <div className={styles.formHeading}>
          <div><p className={styles.eyebrow}>Catálogo persistido</p><h3>Versiones no editables</h3></div>
        </div>
        {context.entries.filter((entry) => entry.status !== "draft").length > 0 ? (
          <div className={styles.publishedList}>
            {context.entries.filter((entry) => entry.status !== "draft").map((entry) => (
              <Card as="article" surface="soft" key={entry.challengeVersionId} className={styles.publishedCard}>
                <div>
                  <p className={styles.eyebrow}>{entry.slug} · v{entry.versionNumber}</p>
                  <h4>{entry.title}</h4>
                  <p className={styles.versionMeta}>
                    Actualizado {formatTimestamp(entry.updatedAt)} UTC
                    {entry.publishedAt ? ` · Publicado ${formatTimestamp(entry.publishedAt)} UTC` : ""}
                  </p>
                </div>
                <Chip variant="status" tone={statusTone(entry.status)}>{statusLabel(entry.status)}</Chip>
              </Card>
            ))}
          </div>
        ) : <p className={styles.helper}>Todavía no hay versiones publicadas.</p>}
      </div>
    </section>
  );
}
