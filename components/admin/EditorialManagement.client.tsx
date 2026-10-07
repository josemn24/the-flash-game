"use client";

import {
  useActionState,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

import { Button, Card, Chip, FormField, Textarea } from "@/components/ui";

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
  SuperadminChallengeVersionComparison,
  SuperadminEditorialContext,
  SuperadminQuestionLibraryContext,
} from "@/types/view-models/editorial";
import { AdminSectionHeader } from "./AdminSectionHeader";
import styles from "./EditorialManagement.module.css";
import { EditorialPreview } from "./EditorialPreview";

import { EditorialDraftSelector } from "./editorial/EditorialDraftSelector";
import { ErrorMessage, ReasonField, formatTimestamp } from "./editorial/EditorialFormFields";
import { EditorialLibrarySelector } from "./editorial/EditorialLibrarySelector";
import { EditorialModeSettings } from "./editorial/EditorialModeSettings";
import { EditorialVersionHistory } from "./editorial/EditorialVersionHistory";

import {
  changeEditorialLives,
  changeEditorialMode,
  replaceEditorialLibraryQuestion,
} from "@/lib/editorial/draftTransforms";

import { emptyEditorialDocument } from "@/lib/editorial/emptyDocument";

const initialState: EditorialActionState = {};

function newKey() {
  return globalThis.crypto.randomUUID();
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
      : formatFlashEditorialDocument(emptyEditorialDocument),
  );
  const [previewError, setPreviewError] = useState("");
  const publishedLibraryEntries =
    questionLibrary?.entries.filter((entry) => entry.status === "published") ?? [];
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

  function updateMode(mode: FlashEditorialDocument["challenge"]["mode"]) {
    if (!parsedDocument) return;
    setDocumentText(formatFlashEditorialDocument(changeEditorialMode(parsedDocument, mode)));
    setPreviewError("");
  }

  function updateLives(lives: number) {
    if (!parsedDocument || parsedDocument.challenge.mode !== "survival") return;
    setDocumentText(formatFlashEditorialDocument(changeEditorialLives(parsedDocument, lives)));
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
        : formatFlashEditorialDocument(emptyEditorialDocument),
    );
    setPreviewError("");
  }

  function startNewDraft() {
    setSelectedId("");
    setDocumentText(formatFlashEditorialDocument(emptyEditorialDocument));
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
      setDocumentText(
        formatFlashEditorialDocument(replaceEditorialLibraryQuestion(document, index, entry)),
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

            <EditorialDraftSelector
              fieldId={fieldId}
              drafts={drafts}
              selectedId={selectedId}
              onSelect={selectDraft}
              allowNewDraft={allowNewDraft}
              onNewDraft={startNewDraft}
            />

            <EditorialLibrarySelector
              fieldId={fieldId}
              entries={publishedLibraryEntries}
              selectedId={libraryQuestionId}
              onSelect={setLibraryQuestionId}
              replaceIndex={replaceIndex}
              onReplaceIndex={setReplaceIndex}
              questionCount={parsedDocument?.questions.length ?? 0}
              onUseVersion={selectLibraryQuestion}
            />

            <EditorialModeSettings
              fieldId={fieldId}
              document={parsedDocument}
              onModeChange={updateMode}
              onLivesChange={updateLives}
            />

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

      <EditorialVersionHistory
        fieldId={fieldId}
        context={context}
        comparison={comparison}
        revisionAction={revisionAction}
        revisionState={revisionState}
        revisionPending={revisionPending}
        onRevisionSubmit={(event) => prepareKey(event, revisionKeyRef)}
        archiveAction={archiveAction}
        archiveState={archiveState}
        archivePending={archivePending}
        onArchiveSubmit={(event) => prepareKey(event, archiveKeyRef)}
      />
    </section>
  );
}
