"use client";

import { useActionState, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Button, Card, Chip } from "@/components/ui";
import { AdminSectionHeader } from "./AdminSectionHeader";
import { EditorialPreview } from "./EditorialPreview";
import {
  createFlashDraft,
  publishFlash,
  updateFlashDraft,
  type EditorialActionState,
} from "@/app/admin/editorial-actions";
import {
  FLASH_MAX_QUESTIONS,
  FLASH_MIN_QUESTIONS,
  FLASH_TOTAL_POINTS,
  FlashEditorialValidationError,
  formatFlashEditorialDocument,
  parseFlashEditorialJson,
} from "@/lib/editorial/flashDocument";
import type {
  FlashEditorialDocument,
  FlashEditorialQuestionReference,
  SuperadminEditorialContext,
  SuperadminQuestionLibraryContext,
} from "@/types/view-models/editorial";
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
  questionLibrary,
}: {
  readonly context: SuperadminEditorialContext;
  readonly questionLibrary?: SuperadminQuestionLibraryContext;
}) {
  const drafts = context.entries.filter((entry) => entry.status === "draft");
  const [selectedId, setSelectedId] = useState(drafts[0]?.challengeVersionId ?? "");
  const selected = drafts.find((entry) => entry.challengeVersionId === selectedId) ?? null;
  const [documentText, setDocumentText] = useState(
    selected?.document ? formatFlashEditorialDocument(selected.document) : formatFlashEditorialDocument(emptyDocument),
  );
  const [previewError, setPreviewError] = useState("");
  const publishedLibraryEntries = questionLibrary?.entries.filter((entry) => entry.status === "published") ?? [];
  const [libraryQuestionId, setLibraryQuestionId] = useState(publishedLibraryEntries[0]?.questionVersionId ?? "");
  const [replaceIndex, setReplaceIndex] = useState("0");
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

  const documentSummary = parsedDocument
    ? `Flash · ${parsedDocument.questions.length} preguntas · ${parsedDocument.questions.reduce((total, question) => total + question.points, 0)} puntos`
    : `Flash · ${FLASH_MIN_QUESTIONS}–${FLASH_MAX_QUESTIONS} preguntas · ${FLASH_TOTAL_POINTS} puntos`;

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

  function selectLibraryQuestion() {
    const entry = publishedLibraryEntries.find((candidate) => candidate.questionVersionId === libraryQuestionId);
    if (!entry) return;
    try {
      const document = parseFlashEditorialJson(documentText);
      const index = Number(replaceIndex);
      const current = document.questions[index];
      const reference: FlashEditorialQuestionReference = {
        source: "library",
        questionVersionId: entry.questionVersionId,
        points: current?.points ?? 50,
        modeConfig: {},
        ...(current && "challengeItemId" in current && current.challengeItemId
          ? { challengeItemId: current.challengeItemId }
          : {}),
      };
      setDocumentText(formatFlashEditorialDocument({
        ...document,
        questions: document.questions.map((question, questionIndex) => questionIndex === index ? reference : question),
      }));
      setPreviewError("");
    } catch {
      setPreviewError("Corrige el documento antes de seleccionar una pregunta de biblioteca.");
    }
  }

  return (
    <section className={styles.section} aria-labelledby="editorial-management-title">
      <AdminSectionHeader id="editorial-management-title" eyebrow="S11 · herramienta editorial" title="Contenido Flash" trailing={<Chip variant="data" tone="social">{context.entries.length} versiones</Chip>} />

      <div className={styles.layout}>
        <Card as="section" className={styles.editorCard} aria-labelledby="editorial-editor-title">
          <div className={styles.formHeading}>
            <div>
              <p className={styles.eyebrow}>JSON estructurado</p>
              <h3 id="editorial-editor-title">{selected ? "Editar borrador" : "Preparar contenido"}</h3>
            </div>
            <span className={styles.helper}>
              {selected
                ? `${documentSummary} · actualizado ${formatTimestamp(selected.updatedAt)} UTC`
                : documentSummary}
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

          {publishedLibraryEntries.length > 0 ? (
            <div className={styles.draftSelector}>
              <label className={styles.field}>
                <span>Versión publicada de biblioteca</span>
                <select value={libraryQuestionId} onChange={(event) => setLibraryQuestionId(event.target.value)}>
                  {publishedLibraryEntries.map((entry) => <option key={entry.questionVersionId} value={entry.questionVersionId}>{entry.slug} · v{entry.versionNumber} · {entry.type}</option>)}
                </select>
              </label>
              <label className={styles.field}>
                <span>Sustituir pregunta</span>
                <select value={replaceIndex} onChange={(event) => setReplaceIndex(event.target.value)}>
                  {parsedDocument?.questions.map((_, index) => <option key={index} value={index}>#{index + 1}</option>)}
                </select>
              </label>
              <Button type="button" variant="secondary" onClick={selectLibraryQuestion}>Usar versión</Button>
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
