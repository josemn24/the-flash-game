"use client";

import { useActionState, useRef, useState } from "react";
import { Button, Card, Chip } from "@/components/ui";
import { formatFlashEditorialQuestionDocument } from "@/lib/editorial/flashDocument";
import type { SuperadminQuestionVersionDetail } from "@/types/view-models/editorial";
import {
  abortQuestionAsset,
  archiveQuestion,
  confirmQuestionAsset,
  createQuestionDraft,
  prepareQuestionAsset,
  publishQuestion,
  updateQuestionDraft,
  type QuestionActionState,
} from "@/app/admin/question-actions";
import { createClient } from "@/lib/supabase/client";
import styles from "./QuestionVersionEditor.module.css";

const initialState: QuestionActionState = {};
const emptyQuestion = {
  slug: "pregunta-nueva",
  type: "multiple-choice",
  payloadSchemaVersion: 1,
  timeLimitMs: 15000,
  publicPayload: {
    category: "Cultura general",
    tags: {},
    question: "¿Cuál es la respuesta?",
    options: ["A", "B"],
    media: null,
    promptVisual: null,
  },
  solutionPayload: { correctAnswer: "A", explanation: "" },
} as const;

function key() {
  return globalThis.crypto.randomUUID();
}
function ErrorMessage({ state }: { readonly state: QuestionActionState }) {
  return state.message ? (
    <p className={styles.error} role="alert">
      {state.message} {Object.values(state.fieldErrors ?? {}).join(" ")}
    </p>
  ) : null;
}
function Reason() {
  return (
    <label className={styles.reason}>
      <span>Motivo de auditoría</span>
      <textarea
        name="reason"
        rows={2}
        maxLength={500}
        required
        placeholder="Preparar pregunta para la biblioteca"
      />
    </label>
  );
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function QuestionAssetUploader({
  document,
  onDocumentChange,
}: {
  readonly document: string;
  readonly onDocumentChange: (value: string) => void;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [altText, setAltText] = useState("");
  const [fit, setFit] = useState<"" | "cover" | "contain">("");
  const [position, setPosition] = useState("");
  let target: "multiple-choice" | "progressive-image" | "heat-map" | null = null;
  let currentReference: Record<string, unknown> = {};
  let progressiveImage = false;
  try {
    const parsed = JSON.parse(document) as { type?: unknown; publicPayload?: unknown };
    if (
      parsed.type === "progressive-image" ||
      parsed.type === "multiple-choice" ||
      parsed.type === "heat-map"
    ) {
      target = parsed.type;
      progressiveImage = parsed.type === "progressive-image";
      const publicPayload = isRecord(parsed.publicPayload) ? parsed.publicPayload : {};
      const reference = publicPayload[parsed.type === "progressive-image" ? "surface" : "media"];
      currentReference = isRecord(reference) ? reference : {};
    }
  } catch {
    /* The JSON editor displays the validation error. */
  }
  if (!target) return null;

  const currentAlt = typeof currentReference.alt === "string" ? currentReference.alt : "";
  const currentFit =
    currentReference.fit === "cover" || currentReference.fit === "contain"
      ? currentReference.fit
      : "";
  const currentPosition =
    typeof currentReference.position === "string" ? currentReference.position : "";
  const effectiveAlt = altText || currentAlt;
  const effectiveFit = fit || currentFit;
  const effectivePosition = position || currentPosition;

  async function upload(file: File) {
    setMessage(null);
    setPending(true);
    const idempotencyKey = crypto.randomUUID();
    try {
      const alt = effectiveAlt.trim();
      if (!alt || alt.length > 500) {
        setMessage("Introduce un texto alternativo de entre 1 y 500 caracteres.");
        return;
      }
      const prepared = await prepareQuestionAsset({
        mimeType: file.type,
        byteSize: file.size,
        idempotencyKey,
      });
      if (!prepared.ok) {
        setMessage(prepared.message);
        return;
      }
      const { error } = await createClient()
        .storage.from("question-assets")
        .uploadToSignedUrl(prepared.objectPath, prepared.uploadToken, file, {
          contentType: file.type,
          upsert: false,
        });
      if (error) {
        await abortQuestionAsset(prepared.assetId);
        setMessage("No se ha podido subir el asset.");
        return;
      }
      const confirmed = await confirmQuestionAsset({
        assetId: prepared.assetId,
        idempotencyKey: prepared.confirmIdempotencyKey,
      });
      if (!confirmed.ok) {
        setMessage(confirmed.message);
        return;
      }
      const parsed = JSON.parse(document) as Record<string, unknown>;
      const publicPayload = (parsed.publicPayload ?? {}) as Record<string, unknown>;
      const referenceKey = target === "multiple-choice" ? "media" : "surface";
      const reference = (publicPayload[referenceKey] ?? {}) as Record<string, unknown>;
      const privateReference =
        target === "multiple-choice"
          ? {
              type: "image",
              assetId: confirmed.assetId,
              alt,
              width: confirmed.width,
              height: confirmed.height,
              ...(effectiveFit ? { fit: effectiveFit } : {}),
              ...(effectivePosition ? { position: effectivePosition } : {}),
            }
          : {
              ...reference,
              assetId: confirmed.assetId,
              alt,
              width: confirmed.width,
              height: confirmed.height,
              ...(effectiveFit ? { fit: effectiveFit } : {}),
              ...(effectivePosition ? { position: effectivePosition } : {}),
            };
      onDocumentChange(
        JSON.stringify(
          {
            ...parsed,
            payloadSchemaVersion: 2,
            publicPayload: { ...publicPayload, [referenceKey]: privateReference },
          },
          null,
          2,
        ),
      );
      setMessage("Asset confirmado y vinculado al documento.");
    } catch {
      setMessage("No se ha podido completar la subida.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={styles.assetPanel}>
      <div>
        <strong>
          Asset privado de{" "}
          {target === "heat-map"
            ? "heat-map"
            : progressiveImage
              ? "progressive-image"
              : "multiple-choice"}
        </strong>
        <span>El servidor inspecciona los bytes y guarda solo el assetId.</span>
      </div>
      <div className={styles.assetFields}>
        <label>
          <span>Texto alternativo</span>
          <input
            value={effectiveAlt}
            maxLength={500}
            onChange={(event) => setAltText(event.target.value)}
            placeholder="Describe la imagen"
          />
        </label>
        <label>
          <span>Ajuste</span>
          <select
            value={effectiveFit}
            onChange={(event) => setFit(event.target.value as "" | "cover" | "contain")}
          >
            <option value="">Predeterminado</option>
            <option value="cover">Cover</option>
            <option value="contain">Contain</option>
          </select>
        </label>
        <label>
          <span>Posición</span>
          <input
            value={effectivePosition}
            maxLength={100}
            onChange={(event) => setPosition(event.target.value)}
            placeholder="center"
          />
        </label>
      </div>
      <label className={styles.fileInput}>
        <span>Seleccionar JPEG, PNG o WebP</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={pending}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
            event.currentTarget.value = "";
          }}
        />
      </label>
      {pending ? <span role="status">Subiendo y confirmando…</span> : null}
      {message ? (
        <span className={styles.assetMessage} role="status">
          {message}
        </span>
      ) : null}
    </div>
  );
}

export function QuestionVersionEditor({
  detail,
  newQuestion = false,
}: {
  readonly detail?: SuperadminQuestionVersionDetail;
  readonly newQuestion?: boolean;
}) {
  const latest = detail?.versions[0];
  const editable = latest?.status === "draft" && latest.document;
  const [text, setText] = useState(
    editable
      ? formatFlashEditorialQuestionDocument(editable)
      : formatFlashEditorialQuestionDocument(emptyQuestion),
  );
  const [createState, createAction, createPending] = useActionState(
    createQuestionDraft,
    initialState,
  );
  const [updateState, updateAction, updatePending] = useActionState(
    updateQuestionDraft,
    initialState,
  );
  const [publishState, publishAction, publishPending] = useActionState(
    publishQuestion,
    initialState,
  );
  const [archiveState, archiveAction, archivePending] = useActionState(
    archiveQuestion,
    initialState,
  );
  const createKey = useRef<string | null>(null);
  const updateKey = useRef<string | null>(null);
  const publishKey = useRef<string | null>(null);
  const archiveKey = useRef<string | null>(null);
  function prepare(event: React.FormEvent<HTMLFormElement>, ref: { current: string | null }) {
    if (!ref.current) ref.current = key();
    const input = event.currentTarget.elements.namedItem("idempotencyKey");
    if (input instanceof HTMLInputElement) input.value = ref.current;
  }
  const formTarget = latest?.questionVersionId;

  return (
    <section className={styles.section} aria-labelledby="question-editor-title">
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>S17a · versión immutable</p>
          <h1 id="question-editor-title">{newQuestion ? "Nueva pregunta" : detail?.slug}</h1>
        </div>
        {latest ? (
          <Chip
            variant="status"
            tone={
              latest.status === "published"
                ? "success"
                : latest.status === "draft"
                  ? "info"
                  : "neutral"
            }
          >
            {latest.status}
          </Chip>
        ) : null}
      </div>
      <div className={styles.layout}>
        <Card as="section" className={styles.editor}>
          <label className={styles.field}>
            <span>Documento standalone (sin points)</span>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={28}
              spellCheck={false}
            />
          </label>
          <QuestionAssetUploader document={text} onDocumentChange={setText} />
          {newQuestion || !formTarget ? (
            <form action={createAction} onSubmit={(event) => prepare(event, createKey)}>
              <input type="hidden" name="idempotencyKey" />
              <input type="hidden" name="document" value={text} readOnly />
              {detail?.questionDefinitionId ? (
                <input
                  type="hidden"
                  name="questionDefinitionId"
                  value={detail.questionDefinitionId}
                />
              ) : null}
              <Reason />
              <ErrorMessage state={createState} />
              <Button type="submit" loading={createPending}>
                Crear borrador
              </Button>
            </form>
          ) : editable ? (
            <form action={updateAction} onSubmit={(event) => prepare(event, updateKey)}>
              <input type="hidden" name="idempotencyKey" />
              <input type="hidden" name="questionVersionId" value={formTarget} />
              <input type="hidden" name="expectedUpdatedAt" value={latest.updatedAt} />
              <input type="hidden" name="document" value={text} readOnly />
              <Reason />
              <ErrorMessage state={updateState} />
              <Button type="submit" loading={updatePending}>
                Guardar borrador
              </Button>
            </form>
          ) : (
            <form action={createAction} onSubmit={(event) => prepare(event, createKey)}>
              <input type="hidden" name="idempotencyKey" />
              <input
                type="hidden"
                name="questionDefinitionId"
                value={detail?.questionDefinitionId}
              />
              <input type="hidden" name="document" value={text} readOnly />
              <Reason />
              <ErrorMessage state={createState} />
              <Button type="submit" loading={createPending}>
                Crear nueva versión
              </Button>
            </form>
          )}
          {latest?.status === "draft" ? (
            <form action={publishAction} onSubmit={(event) => prepare(event, publishKey)}>
              <input type="hidden" name="idempotencyKey" />
              <input type="hidden" name="questionVersionId" value={latest.questionVersionId} />
              <input type="hidden" name="expectedUpdatedAt" value={latest.updatedAt} />
              <Reason />
              <ErrorMessage state={publishState} />
              <Button type="submit" loading={publishPending}>
                Publicar versión
              </Button>
            </form>
          ) : null}
          {latest?.status === "published" ? (
            <form
              action={archiveAction}
              onSubmit={(event) => {
                if (!window.confirm("¿Archivar esta versión?")) event.preventDefault();
                else prepare(event, archiveKey);
              }}
            >
              <input type="hidden" name="idempotencyKey" />
              <input type="hidden" name="questionVersionId" value={latest.questionVersionId} />
              <input type="hidden" name="expectedUpdatedAt" value={latest.updatedAt} />
              <Reason />
              <ErrorMessage state={archiveState} />
              <Button type="submit" variant="secondary" loading={archivePending}>
                Archivar versión
              </Button>
            </form>
          ) : null}
        </Card>
        <Card as="section" surface="soft" className={styles.history}>
          <p className={styles.eyebrow}>Historial</p>
          <h2>Versiones</h2>
          {detail?.versions.map((version) => (
            <div className={styles.version} key={version.questionVersionId}>
              <strong>
                v{version.versionNumber} · {version.status}
              </strong>
              <span>{version.questionVersionId}</span>
              <span>{version.usageCount} usos</span>
            </div>
          ))}
        </Card>
      </div>
    </section>
  );
}
