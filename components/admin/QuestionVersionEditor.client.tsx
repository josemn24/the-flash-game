"use client";

import { useActionState, useRef, useState } from "react";
import { Button, Card, Chip } from "@/components/ui";
import { formatFlashEditorialQuestionDocument } from "@/lib/editorial/flashDocument";
import type { SuperadminQuestionVersionDetail } from "@/types/view-models/editorial";
import { archiveQuestion, createQuestionDraft, publishQuestion, updateQuestionDraft, type QuestionActionState } from "@/app/admin/question-actions";
import styles from "./QuestionVersionEditor.module.css";

const initialState: QuestionActionState = {};
const emptyQuestion = {
  slug: "pregunta-nueva",
  type: "multiple-choice",
  payloadSchemaVersion: 1,
  timeLimitMs: 15000,
  publicPayload: { category: "Cultura general", tags: {}, question: "¿Cuál es la respuesta?", options: ["A", "B"], media: null, promptVisual: null },
  solutionPayload: { correctAnswer: "A", explanation: "" },
} as const;

function key() { return globalThis.crypto.randomUUID(); }
function ErrorMessage({ state }: { readonly state: QuestionActionState }) { return state.message ? <p className={styles.error} role="alert">{state.message} {Object.values(state.fieldErrors ?? {}).join(" ")}</p> : null; }
function Reason() { return <label className={styles.reason}><span>Motivo de auditoría</span><textarea name="reason" rows={2} maxLength={500} required placeholder="Preparar pregunta para la biblioteca" /></label>; }

export function QuestionVersionEditor({ detail, newQuestion = false }: { readonly detail?: SuperadminQuestionVersionDetail; readonly newQuestion?: boolean }) {
  const latest = detail?.versions[0];
  const editable = latest?.status === "draft" && latest.document;
  const [text, setText] = useState(editable ? formatFlashEditorialQuestionDocument(editable) : formatFlashEditorialQuestionDocument(emptyQuestion));
  const [createState, createAction, createPending] = useActionState(createQuestionDraft, initialState);
  const [updateState, updateAction, updatePending] = useActionState(updateQuestionDraft, initialState);
  const [publishState, publishAction, publishPending] = useActionState(publishQuestion, initialState);
  const [archiveState, archiveAction, archivePending] = useActionState(archiveQuestion, initialState);
  const createKey = useRef<string | null>(null); const updateKey = useRef<string | null>(null); const publishKey = useRef<string | null>(null); const archiveKey = useRef<string | null>(null);
  function prepare(event: React.FormEvent<HTMLFormElement>, ref: { current: string | null }) { if (!ref.current) ref.current = key(); const input = event.currentTarget.elements.namedItem("idempotencyKey"); if (input instanceof HTMLInputElement) input.value = ref.current; }
  const formTarget = latest?.questionVersionId;

  return (
    <section className={styles.section} aria-labelledby="question-editor-title">
      <div className={styles.heading}><div><p className={styles.eyebrow}>S17a · versión immutable</p><h1 id="question-editor-title">{newQuestion ? "Nueva pregunta" : detail?.slug}</h1></div>{latest ? <Chip variant="status" tone={latest.status === "published" ? "success" : latest.status === "draft" ? "info" : "neutral"}>{latest.status}</Chip> : null}</div>
      <div className={styles.layout}>
        <Card as="section" className={styles.editor}>
          <label className={styles.field}><span>Documento standalone (sin points)</span><textarea value={text} onChange={(event) => setText(event.target.value)} rows={28} spellCheck={false} /></label>
          {newQuestion || !formTarget ? (
            <form action={createAction} onSubmit={(event) => prepare(event, createKey)}><input type="hidden" name="idempotencyKey" /><input type="hidden" name="document" value={text} readOnly />{detail?.questionDefinitionId ? <input type="hidden" name="questionDefinitionId" value={detail.questionDefinitionId} /> : null}<Reason /><ErrorMessage state={createState} /><Button type="submit" loading={createPending}>Crear borrador</Button></form>
          ) : editable ? (
            <form action={updateAction} onSubmit={(event) => prepare(event, updateKey)}><input type="hidden" name="idempotencyKey" /><input type="hidden" name="questionVersionId" value={formTarget} /><input type="hidden" name="expectedUpdatedAt" value={latest.updatedAt} /><input type="hidden" name="document" value={text} readOnly /><Reason /><ErrorMessage state={updateState} /><Button type="submit" loading={updatePending}>Guardar borrador</Button></form>
          ) : (
            <form action={createAction} onSubmit={(event) => prepare(event, createKey)}><input type="hidden" name="idempotencyKey" /><input type="hidden" name="questionDefinitionId" value={detail?.questionDefinitionId} /><input type="hidden" name="document" value={text} readOnly /><Reason /><ErrorMessage state={createState} /><Button type="submit" loading={createPending}>Crear nueva versión</Button></form>
          )}
          {latest?.status === "draft" ? <form action={publishAction} onSubmit={(event) => prepare(event, publishKey)}><input type="hidden" name="idempotencyKey" /><input type="hidden" name="questionVersionId" value={latest.questionVersionId} /><input type="hidden" name="expectedUpdatedAt" value={latest.updatedAt} /><Reason /><ErrorMessage state={publishState} /><Button type="submit" loading={publishPending}>Publicar versión</Button></form> : null}
          {latest?.status === "published" ? <form action={archiveAction} onSubmit={(event) => { if (!window.confirm("¿Archivar esta versión?")) event.preventDefault(); else prepare(event, archiveKey); }}><input type="hidden" name="idempotencyKey" /><input type="hidden" name="questionVersionId" value={latest.questionVersionId} /><input type="hidden" name="expectedUpdatedAt" value={latest.updatedAt} /><Reason /><ErrorMessage state={archiveState} /><Button type="submit" variant="secondary" loading={archivePending}>Archivar versión</Button></form> : null}
        </Card>
        <Card as="section" surface="soft" className={styles.history}><p className={styles.eyebrow}>Historial</p><h2>Versiones</h2>{detail?.versions.map((version) => <div className={styles.version} key={version.questionVersionId}><strong>v{version.versionNumber} · {version.status}</strong><span>{version.questionVersionId}</span><span>{version.usageCount} usos</span></div>)}</Card>
      </div>
    </section>
  );
}
