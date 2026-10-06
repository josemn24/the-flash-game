"use client";

import {
  useId,
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

import { FormField, Textarea, Select, Input, Button, Card, Chip } from "@/components/ui";

import Link from "next/link";

import { AdminSectionHeader } from "./AdminSectionHeader";
import { EditorialPreview } from "./EditorialPreview";
import {
  archiveChallengeVersion,
  createChallengeRevision,
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
  SuperadminChallengeVersionComparison,
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
  const details = [
    ...new Set(
      Object.entries(state.fieldErrors ?? {})
        .filter(([key]) => key !== "form")
        .map(([, message]) => message),
    ),
  ];
  return (
    <p className={styles.error} role="alert">
      {state.message}
      {details.length > 0 ? ` ${details.join(" ")}` : ""}
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
  const fieldId = useId();
  return (
    <FormField id={fieldId + "-reason"} label="Motivo de auditoría" density="compact" required>
      {(field) => (
        <Textarea
          {...field}
          name="reason"
          maxLength={500}
          rows={2}
          placeholder="Preparar contenido de la beta"
        />
      )}
    </FormField>
  );
}

function jsonValue(value: unknown) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function changed(from: unknown, to: unknown) {
  return JSON.stringify(from) !== JSON.stringify(to);
}

function ComparisonPanel({
  comparison,
}: {
  readonly comparison: SuperadminChallengeVersionComparison;
}) {
  const fields = [
    ["Título", comparison.from.title, comparison.to.title],
    ["Subtítulo", comparison.from.subtitle, comparison.to.subtitle],
    ["Descripción", comparison.from.description, comparison.to.description],
    ["Modo", comparison.from.mode, comparison.to.mode],
    ["Configuración del modo", comparison.from.modeConfig, comparison.to.modeConfig],
  ] as const;
  const fieldChanges = fields.filter(([, from, to]) => changed(from, to));
  const maxItems = Math.max(comparison.from.items.length, comparison.to.items.length);
  const itemChanges = Array.from({ length: maxItems }, (_, index) => {
    const from = comparison.from.items[index];
    const to = comparison.to.items[index];
    if (!from || !to) return { position: index + 1, from, to, changes: ["elemento"] };
    const changes = [
      changed(from.questionVersionId, to.questionVersionId) && "referencia",
      changed(from.slug, to.slug) && "slug",
      changed(from.type, to.type) && "formato",
      changed(from.timeLimitMs, to.timeLimitMs) && "tiempo",
      changed(from.points, to.points) && "puntos",
      changed(from.modeConfig, to.modeConfig) && "configuración",
      changed(from.publicPayload, to.publicPayload) && "contenido público",
    ].filter(Boolean) as string[];
    return { position: index + 1, from, to, changes };
  }).filter((item) => item.changes.length > 0);
  const hasChanges = fieldChanges.length > 0 || itemChanges.length > 0;

  return (
    <Card as="section" surface="soft" aria-labelledby="editorial-comparison-title">
      <div className={styles.formHeading}>
        <div>
          <p className={styles.eyebrow}>Comparación editorial</p>
          <h3 id="editorial-comparison-title">
            v{comparison.from.versionNumber} → v{comparison.to.versionNumber}
          </h3>
        </div>
        <span className={styles.helper}>
          Se comparan referencias y payloads públicos; las soluciones privadas no se muestran.
        </span>
      </div>
      {hasChanges ? (
        <div className={styles.comparisonList}>
          {fieldChanges.map(([label, from, to]) => (
            <div className={styles.comparisonRow} key={label}>
              <strong>{label}</strong>
              <span>{jsonValue(from)}</span>
              <span>{jsonValue(to)}</span>
            </div>
          ))}
          {itemChanges.map((item) => (
            <div className={styles.comparisonRow} key={item.position}>
              <strong>Pregunta #{item.position}</strong>
              <span>{item.from ? item.changes.join(", ") : "Elemento añadido"}</span>
              <span>{item.to ? item.changes.join(", ") : "Elemento eliminado"}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className={styles.helper}>No hay diferencias editoriales entre estas versiones.</p>
      )}
    </Card>
  );
}

export function EditorialManagement({
  context,
  questionLibrary,
  comparison,
  initialDraftId,
  title = "Desafíos",
  eyebrow = "S11 · herramienta editorial",
  canCreate = true,
  allowNewDraft = true,
}: {
  readonly context: SuperadminEditorialContext;
  readonly questionLibrary?: SuperadminQuestionLibraryContext;
  readonly comparison?: SuperadminChallengeVersionComparison | null;
  readonly initialDraftId?: string;
  readonly title?: string;
  readonly eyebrow?: string;
  readonly canCreate?: boolean;
  readonly allowNewDraft?: boolean;
}) {
  const fieldId = useId();
  const drafts = context.entries.filter((entry) => entry.status === "draft");
  const [selectedId, setSelectedId] = useState(
    initialDraftId && drafts.some((entry) => entry.challengeVersionId === initialDraftId)
      ? initialDraftId
      : (drafts[0]?.challengeVersionId ?? ""),
  );
  const selected = drafts.find((entry) => entry.challengeVersionId === selectedId) ?? null;
  const [documentText, setDocumentText] = useState(
    selected?.document
      ? formatFlashEditorialDocument(selected.document)
      : formatFlashEditorialDocument(emptyDocument),
  );
  const [previewError, setPreviewError] = useState("");
  const publishedLibraryEntries =
    questionLibrary?.entries.filter((entry) => entry.status === "published") ?? [];
  const challengeDefinitionId = context.entries[0]?.challengeDefinitionId ?? "";
  const historicalEntries = context.entries.filter((entry) => entry.status !== "draft");
  const [libraryQuestionId, setLibraryQuestionId] = useState(
    publishedLibraryEntries[0]?.questionVersionId ?? "",
  );
  const [replaceIndex, setReplaceIndex] = useState("0");
  const [createState, createAction, createPending] = useActionState(createFlashDraft, initialState);
  const [updateState, updateAction, updatePending] = useActionState(updateFlashDraft, initialState);
  const [publishState, publishAction, publishPending] = useActionState(publishFlash, initialState);
  const [revisionState, revisionAction, revisionPending] = useActionState(
    createChallengeRevision,
    initialState,
  );
  const [archiveState, archiveAction, archivePending] = useActionState(
    archiveChallengeVersion,
    initialState,
  );
  const createKeyRef = useRef<string | null>(null);
  const updateKeyRef = useRef<string | null>(null);
  const publishKeyRef = useRef<string | null>(null);
  const revisionKeyRef = useRef<string | null>(null);
  const archiveKeyRef = useRef<string | null>(null);
  const hasEditableSurface = canCreate || Boolean(selected);
  useResetKeyWhenError(createState, createKeyRef);
  useResetKeyWhenError(updateState, updateKeyRef);
  useResetKeyWhenError(publishState, publishKeyRef);
  useResetKeyWhenError(revisionState, revisionKeyRef);
  useResetKeyWhenError(archiveState, archiveKeyRef);

  const parsedDocument = useMemo(() => {
    try {
      return parseFlashEditorialJson(documentText);
    } catch (error) {
      return error instanceof FlashEditorialValidationError ? null : null;
    }
  }, [documentText]);

  const documentSummary = parsedDocument
    ? `${parsedDocument.challenge.mode === "survival" ? "Supervivencia" : parsedDocument.challenge.mode === "alphabet" ? "Alphabet" : parsedDocument.challenge.mode === "narrative" ? "Narrativa" : parsedDocument.challenge.mode === "pyramid" ? "La Pirámide" : "Flash"} · ${parsedDocument.challenge.mode === "pyramid" ? `${parsedDocument.questions.length}/7 niveles` : `${parsedDocument.questions.length} preguntas`} · ${parsedDocument.questions.reduce((total, question) => total + question.points, 0)} puntos`
    : `Flash · ${FLASH_MIN_QUESTIONS}–${FLASH_MAX_QUESTIONS} preguntas · ${FLASH_TOTAL_POINTS} puntos`;

  function pyramidLevelModeConfig(index: number, format: string) {
    const label = `Nivel ${index + 1}`;
    return {
      levelId: `level-${index + 1}`,
      label,
      briefing: {
        title: label,
        format,
        description: "Resuelve la prueba para abrir el siguiente nivel.",
      },
    };
  }

  function updateMode(mode: FlashEditorialDocument["challenge"]["mode"]) {
    if (!parsedDocument) return;
    const { globalTimeLimitMs: _oldLimit, ...challenge } = parsedDocument.challenge;
    setDocumentText(
      formatFlashEditorialDocument({
        ...parsedDocument,
        challenge: {
          ...challenge,
          mode,
          modeConfig:
            mode === "survival" ? { lives: Math.min(3, parsedDocument.questions.length) } : {},
          ...(mode === "alphabet" ? { globalTimeLimitMs: _oldLimit ?? 300000 } : {}),
        },
        questions:
          mode === "pyramid"
            ? parsedDocument.questions.map((question, index) => ({
                ...question,
                modeConfig:
                  question.modeConfig && Object.keys(question.modeConfig).length > 0
                    ? question.modeConfig
                    : pyramidLevelModeConfig(index, "Prueba competitiva"),
              }))
            : parsedDocument.questions.map((question) => {
                if ("source" in question) return { ...question, modeConfig: {} };
                const standaloneQuestion = { ...question };
                Reflect.deleteProperty(standaloneQuestion, "modeConfig");
                return standaloneQuestion;
              }),
      }),
    );
    setPreviewError("");
  }

  function updateLives(lives: number) {
    if (!parsedDocument || parsedDocument.challenge.mode !== "survival") return;
    setDocumentText(
      formatFlashEditorialDocument({
        ...parsedDocument,
        challenge: { ...parsedDocument.challenge, modeConfig: { lives } },
      }),
    );
    setPreviewError("");
  }

  function validatePreview() {
    try {
      parseFlashEditorialJson(documentText);
      setPreviewError("");
    } catch (error) {
      setPreviewError(
        error instanceof FlashEditorialValidationError
          ? (error.issues[0] ?? "El JSON no cumple el contrato editorial.")
          : "El documento no contiene JSON válido.",
      );
    }
  }

  function selectDraft(event: ChangeEvent<HTMLSelectElement>) {
    const nextId = event.target.value;
    const nextDraft = drafts.find((entry) => entry.challengeVersionId === nextId);
    setSelectedId(nextId);
    setDocumentText(
      nextDraft?.document
        ? formatFlashEditorialDocument(nextDraft.document)
        : formatFlashEditorialDocument(emptyDocument),
    );
    setPreviewError("");
  }

  function startNewDraft() {
    setSelectedId("");
    setDocumentText(formatFlashEditorialDocument(emptyDocument));
    setPreviewError("");
  }

  function selectLibraryQuestion() {
    const entry = publishedLibraryEntries.find(
      (candidate) => candidate.questionVersionId === libraryQuestionId,
    );
    if (!entry) return;
    try {
      const document = parseFlashEditorialJson(documentText);
      const index = Number(replaceIndex);
      const current = document.questions[index];
      const reference: FlashEditorialQuestionReference = {
        source: "library",
        questionVersionId: entry.questionVersionId,
        points: current?.points ?? 50,
        modeConfig:
          document.challenge.mode === "pyramid"
            ? (current?.modeConfig ?? pyramidLevelModeConfig(index, entry.type))
            : {},
        ...(current && "challengeItemId" in current && current.challengeItemId
          ? { challengeItemId: current.challengeItemId }
          : {}),
      };
      setDocumentText(
        formatFlashEditorialDocument({
          ...document,
          questions: document.questions.map((question, questionIndex) =>
            questionIndex === index ? reference : question,
          ),
        }),
      );
      setPreviewError("");
    } catch {
      setPreviewError("Corrige el documento antes de seleccionar una pregunta de biblioteca.");
    }
  }

  return (
    <section className={styles.section} aria-labelledby="editorial-management-title">
      <AdminSectionHeader
        id="editorial-management-title"
        eyebrow={eyebrow}
        title={title}
        trailing={
          <Chip variant="data" tone="social">
            {context.entries.length} versiones
          </Chip>
        }
      />

      {hasEditableSurface ? (
        <div className={styles.layout}>
          <Card as="section" className={styles.editorCard} aria-labelledby="editorial-editor-title">
            <div className={styles.formHeading}>
              <div>
                <p className={styles.eyebrow}>JSON estructurado</p>
                <h3 id="editorial-editor-title">
                  {selected ? "Editar borrador" : "Preparar contenido"}
                </h3>
              </div>
              <span className={styles.helper}>
                {selected
                  ? `${documentSummary} · actualizado ${formatTimestamp(selected.updatedAt)} UTC`
                  : documentSummary}
              </span>
            </div>

            {drafts.length > 0 ? (
              <div className={styles.draftSelector}>
                <FormField id={fieldId + "-borrador"} label="Borrador" density="compact">
                  {(field) => (
                    <Select {...field} value={selectedId} onChange={selectDraft}>
                      {drafts.map((entry) => (
                        <option key={entry.challengeVersionId} value={entry.challengeVersionId}>
                          {entry.title} · {entry.slug}
                        </option>
                      ))}
                    </Select>
                  )}
                </FormField>
                {allowNewDraft ? (
                  <Button type="button" variant="secondary" onClick={startNewDraft}>
                    Nuevo borrador
                  </Button>
                ) : null}
              </div>
            ) : null}

            {publishedLibraryEntries.length > 0 ? (
              <>
                <div className={styles.draftSelector}>
                  <FormField
                    id={fieldId + "-version-publicada-de-biblioteca"}
                    label="Versión publicada de biblioteca"
                    density="compact"
                  >
                    {(field) => (
                      <Select
                        {...field}
                        value={libraryQuestionId}
                        onChange={(event) => setLibraryQuestionId(event.target.value)}
                      >
                        {publishedLibraryEntries.map((entry) => (
                          <option key={entry.questionVersionId} value={entry.questionVersionId}>
                            {entry.slug} · v{entry.versionNumber} · {entry.type}
                          </option>
                        ))}
                      </Select>
                    )}
                  </FormField>
                  <FormField
                    id={fieldId + "-sustituir-pregunta"}
                    label="Sustituir pregunta"
                    density="compact"
                  >
                    {(field) => (
                      <Select
                        {...field}
                        value={replaceIndex}
                        onChange={(event) => setReplaceIndex(event.target.value)}
                      >
                        {parsedDocument?.questions.map((_, index) => (
                          <option key={index} value={index}>
                            #{index + 1}
                          </option>
                        ))}
                      </Select>
                    )}
                  </FormField>
                  <Button type="button" variant="secondary" onClick={selectLibraryQuestion}>
                    Usar versión
                  </Button>
                </div>
                <p className={styles.helper}>
                  Las preguntas publicadas son referencias inmutables. Para corregir el enunciado o
                  la solución, crea una nueva versión desde{" "}
                  <Link href="/admin/questions">la biblioteca de preguntas</Link> y selecciónala
                  después en este desafío.
                </p>
              </>
            ) : null}

            {parsedDocument ? (
              <div className={styles.draftSelector}>
                <FormField
                  id={fieldId + "-modo-del-desafio"}
                  label="Modo del desafío"
                  density="compact"
                >
                  {(field) => (
                    <Select
                      {...field}
                      aria-label="Modo del desafío"
                      value={parsedDocument.challenge.mode}
                      onChange={(event) =>
                        updateMode(
                          event.target.value as FlashEditorialDocument["challenge"]["mode"],
                        )
                      }
                    >
                      <option value="flash">Flash</option>
                      <option value="alphabet">Alphabet</option>
                      <option value="survival">Supervivencia</option>
                      {parsedDocument.challenge.mode === "narrative" ? (
                        <option value="narrative">Narrativa</option>
                      ) : null}
                      <option value="pyramid">La Pirámide</option>
                    </Select>
                  )}
                </FormField>
                {parsedDocument.challenge.mode === "survival" ? (
                  <FormField
                    id={fieldId + "-document-0"}
                    label={<>Vidas iniciales (1– {parsedDocument.questions.length} )</>}
                    density="compact"
                  >
                    {(field) => (
                      <Input
                        {...field}
                        aria-label="Vidas iniciales"
                        type="number"
                        min={1}
                        max={parsedDocument.questions.length}
                        step={1}
                        value={parsedDocument.challenge.modeConfig.lives as number}
                        onChange={(event) => updateLives(Number(event.currentTarget.value))}
                      />
                    )}
                  </FormField>
                ) : null}
                {parsedDocument.challenge.mode === "pyramid" ? (
                  <p className={styles.helper}>
                    Configura siete niveles, con una pregunta de biblioteca compatible por nivel,
                    briefings y 100 puntos en total. Admite los formatos competitivos evaluados por
                    servidor, incluidos Verdadero/Falso, Ordenar, Clasificar, Matriz lógica, Zip,
                    Escape y Hashtag de palabras. Solo una respuesta completamente correcta abre el
                    nivel siguiente y acredita sus puntos.
                  </p>
                ) : null}
              </div>
            ) : null}

            <FormField
              id={fieldId + "-document"}
              label="Documento editorial"
              density="compact"
              error={previewError}
              announceError
            >
              {(field) => (
                <Textarea
                  {...field}
                  font="mono"
                  name="document"
                  value={documentText}
                  onChange={(event) => setDocumentText(event.currentTarget.value)}
                  rows={24}
                  spellCheck={false}
                  aria-label="Documento editorial JSON"
                />
              )}
            </FormField>

            <div className={styles.actions}>
              {selected ? (
                <form
                  action={updateAction}
                  onSubmit={(event) => prepareKey(event, updateKeyRef)}
                  aria-busy={updatePending}
                >
                  <input type="hidden" name="idempotencyKey" defaultValue="" />
                  <input
                    type="hidden"
                    name="challengeVersionId"
                    value={selected.challengeVersionId}
                    readOnly
                  />
                  <input
                    type="hidden"
                    name="expectedUpdatedAt"
                    value={selected.updatedAt}
                    readOnly
                  />
                  <input type="hidden" name="document" value={documentText} readOnly />
                  <ReasonField />
                  <ErrorMessage state={updateState} />
                  <Button type="submit" variant="secondary" loading={updatePending}>
                    Guardar borrador
                  </Button>
                </form>
              ) : (
                <form
                  action={createAction}
                  onSubmit={(event) => prepareKey(event, createKeyRef)}
                  aria-busy={createPending}
                >
                  <input type="hidden" name="idempotencyKey" defaultValue="" />
                  <input type="hidden" name="document" value={documentText} readOnly />
                  <ReasonField />
                  <ErrorMessage state={createState} />
                  <Button type="submit" loading={createPending}>
                    Guardar borrador
                  </Button>
                </form>
              )}
              <Button type="button" variant="secondary" onClick={validatePreview}>
                Validar y previsualizar
              </Button>
            </div>

            {selected ? (
              <form
                action={publishAction}
                className={styles.publishForm}
                onSubmit={(event) => {
                  if (
                    !window.confirm(`¿Publicar «${selected.title}»? Después no podrá editarse.`)
                  ) {
                    event.preventDefault();
                    return;
                  }
                  prepareKey(event, publishKeyRef);
                }}
                aria-busy={publishPending}
              >
                <input type="hidden" name="idempotencyKey" defaultValue="" />
                <input
                  type="hidden"
                  name="challengeVersionId"
                  value={selected.challengeVersionId}
                  readOnly
                />
                <input type="hidden" name="expectedUpdatedAt" value={selected.updatedAt} readOnly />
                <ReasonField />
                <ErrorMessage state={publishState} />
                <Button type="submit" loading={publishPending}>
                  Publicar versión
                </Button>
              </form>
            ) : null}
          </Card>

          <div className={styles.previewColumn}>
            {parsedDocument ? (
              <EditorialPreview document={parsedDocument} />
            ) : (
              <Card surface="soft" className={styles.emptyPreview}>
                <p className={styles.eyebrow}>Preview protegido</p>
                <h3>Corrige el JSON para ver el desafío.</h3>
                <p>La validación se ejecuta también en el servidor antes de persistir.</p>
              </Card>
            )}
          </div>
        </div>
      ) : null}

      <div className={styles.published}>
        <div className={styles.formHeading}>
          <div>
            <p className={styles.eyebrow}>Catálogo persistido</p>
            <h3>Versiones no editables</h3>
          </div>
        </div>
        {historicalEntries.length > 0 ? (
          <>
            {historicalEntries.length > 1 ? (
              <form method="get" className={styles.compareSelector}>
                <FormField
                  id={fieldId + "-compareFrom"}
                  label="Comparar versión base"
                  density="compact"
                >
                  {(field) => (
                    <Select
                      {...field}
                      name="compareFrom"
                      defaultValue={
                        comparison?.from.challengeVersionId ??
                        historicalEntries[0]?.challengeVersionId
                      }
                    >
                      {context.entries.map((entry) => (
                        <option key={entry.challengeVersionId} value={entry.challengeVersionId}>
                          v{entry.versionNumber} · {statusLabel(entry.status)} · {entry.title}
                        </option>
                      ))}
                    </Select>
                  )}
                </FormField>
                <FormField id={fieldId + "-compareTo"} label="Comparar con" density="compact">
                  {(field) => (
                    <Select
                      {...field}
                      name="compareTo"
                      defaultValue={
                        comparison?.to.challengeVersionId ??
                        historicalEntries.at(-1)?.challengeVersionId
                      }
                    >
                      {context.entries.map((entry) => (
                        <option key={entry.challengeVersionId} value={entry.challengeVersionId}>
                          v{entry.versionNumber} · {statusLabel(entry.status)} · {entry.title}
                        </option>
                      ))}
                    </Select>
                  )}
                </FormField>
                <Button type="submit" variant="secondary">
                  Comparar versiones
                </Button>
                {comparison ? (
                  <Link
                    href={`/admin/challenges/${challengeDefinitionId}`}
                    className={styles.inlineLink}
                  >
                    Limpiar comparación
                  </Link>
                ) : null}
              </form>
            ) : null}
            <ErrorMessage state={revisionState} />
            <ErrorMessage state={archiveState} />
            {comparison ? <ComparisonPanel comparison={comparison} /> : null}
            <div className={styles.publishedList}>
              {historicalEntries.map((entry) => (
                <Card
                  as="article"
                  surface="soft"
                  key={entry.challengeVersionId}
                  className={styles.publishedCard}
                >
                  <div>
                    <p className={styles.eyebrow}>
                      {entry.slug} · v{entry.versionNumber}
                    </p>
                    <h4>{entry.title}</h4>
                    <p className={styles.versionMeta}>
                      Actualizado {formatTimestamp(entry.updatedAt)} UTC
                      {entry.publishedAt
                        ? ` · Publicado ${formatTimestamp(entry.publishedAt)} UTC`
                        : ""}
                    </p>
                  </div>
                  <Chip variant="status" tone={statusTone(entry.status)}>
                    {statusLabel(entry.status)}
                  </Chip>
                  <div className={styles.versionActions}>
                    <form
                      action={revisionAction}
                      onSubmit={(event) => prepareKey(event, revisionKeyRef)}
                      aria-busy={revisionPending}
                    >
                      <input type="hidden" name="idempotencyKey" defaultValue="" />
                      <input
                        type="hidden"
                        name="sourceChallengeVersionId"
                        value={entry.challengeVersionId}
                        readOnly
                      />
                      <ReasonField />
                      <Button type="submit" variant="secondary" loading={revisionPending}>
                        Crear corrección
                      </Button>
                    </form>
                    {entry.status === "published" ? (
                      <form
                        action={archiveAction}
                        onSubmit={(event) => {
                          if (
                            !window.confirm(
                              `¿Archivar v${entry.versionNumber}? Las publicaciones y revisiones históricas seguirán usando esta versión.`,
                            )
                          ) {
                            event.preventDefault();
                            return;
                          }
                          prepareKey(event, archiveKeyRef);
                        }}
                        aria-busy={archivePending}
                      >
                        <input type="hidden" name="idempotencyKey" defaultValue="" />
                        <input
                          type="hidden"
                          name="challengeVersionId"
                          value={entry.challengeVersionId}
                          readOnly
                        />
                        <input
                          type="hidden"
                          name="expectedUpdatedAt"
                          value={entry.updatedAt}
                          readOnly
                        />
                        <ReasonField />
                        <Button type="submit" variant="secondary" loading={archivePending}>
                          Archivar versión
                        </Button>
                      </form>
                    ) : null}
                  </div>
                </Card>
              ))}
            </div>
          </>
        ) : (
          <p className={styles.helper}>Todavía no hay versiones publicadas.</p>
        )}
      </div>
    </section>
  );
}
