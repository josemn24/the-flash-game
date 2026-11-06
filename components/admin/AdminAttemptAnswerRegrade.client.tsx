"use client";

import { useActionState, useId, useRef, useState, type FormEvent } from "react";
import { Button, FormField, Select, Textarea } from "@/components/ui";
import { randomUuid } from "@/lib/randomUuid";
import {
  applySuperadminAnswerRegrade,
  previewSuperadminAnswerRegrade,
  type AttemptActionState,
} from "@/app/admin/attempt-actions";
import styles from "./AdminAttemptInspection.module.css";

const initialState: AttemptActionState = {};

function stateLabel(status: string | null) {
  return status ?? "Sin resultado";
}

export function AdminAttemptAnswerRegrade({
  roomId,
  scheduledChallengeId,
  attemptId,
  challengeItemId,
  lockVersion,
  answer,
  itemPoints,
  rubrics,
}: {
  readonly roomId: string;
  readonly scheduledChallengeId: string;
  readonly attemptId: string;
  readonly challengeItemId: string;
  readonly lockVersion: number;
  readonly answer: string;
  readonly itemPoints: number;
  readonly rubrics: readonly {
    readonly questionVersionId: string;
    readonly versionNumber: number;
  }[];
}) {
  const fieldId = useId();
  const [selectedRubric, setSelectedRubric] = useState(rubrics[0]?.questionVersionId ?? "");
  const [previewState, previewAction, previewPending] = useActionState(
    previewSuperadminAnswerRegrade,
    initialState,
  );
  const [applyState, applyAction, applyPending] = useActionState(
    applySuperadminAnswerRegrade,
    initialState,
  );
  const submission = useRef<{ input: string; key: string } | null>(null);

  function prepareIdempotencyKey(event: FormEvent<HTMLFormElement>) {
    const reason = new FormData(event.currentTarget).get("reason");
    const input = JSON.stringify([
      attemptId,
      challengeItemId,
      selectedRubric,
      lockVersion,
      typeof reason === "string" ? reason.trim() : "",
    ]);
    if (submission.current?.input !== input) submission.current = { input, key: randomUuid() };
    const field = event.currentTarget.elements.namedItem("idempotencyKey");
    if (field instanceof HTMLInputElement) field.value = submission.current.key;
  }

  const preview =
    previewState.preview?.rubricQuestionVersionId === selectedRubric &&
    previewState.preview.lockVersion === lockVersion
      ? previewState.preview
      : null;

  return (
    <section className={styles.regradePanel} aria-label="Recalcular respuesta">
      <h3>Recalcular respuesta</h3>
      <p className={styles.regradeAnswer}>
        Respuesta original: <strong>{answer}</strong>
      </p>
      {rubrics.length === 0 ? (
        <p className={styles.muted}>No hay versiones publicadas compatibles para esta pregunta.</p>
      ) : (
        <>
          <form action={previewAction} className={styles.regradeForm} aria-busy={previewPending}>
            <input type="hidden" name="roomId" value={roomId} readOnly />
            <input
              type="hidden"
              name="scheduledChallengeId"
              value={scheduledChallengeId}
              readOnly
            />
            <input type="hidden" name="attemptId" value={attemptId} readOnly />
            <input type="hidden" name="challengeItemId" value={challengeItemId} readOnly />
            <input type="hidden" name="lockVersion" value={lockVersion} readOnly />
            <FormField id={fieldId + "-rubric"} label="Rúbrica publicada" density="compact">
              {(field) => (
                <Select
                  {...field}
                  name="rubricQuestionVersionId"
                  value={selectedRubric}
                  onChange={(event) => setSelectedRubric(event.currentTarget.value)}
                  required
                >
                  {rubrics.map((rubric) => (
                    <option key={rubric.questionVersionId} value={rubric.questionVersionId}>
                      Versión {rubric.versionNumber}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
            <Button type="submit" disabled={previewPending || !selectedRubric}>
              {previewPending ? "Calculando…" : "Previsualizar recálculo"}
            </Button>
          </form>
          {previewState.message ? <p className={styles.error}>{previewState.message}</p> : null}
          {preview ? (
            <>
              <dl className={styles.regradePreview}>
                <div>
                  <dt>Resultado original</dt>
                  <dd>
                    {stateLabel(preview.originalStatus)} · {preview.originalPoints}/{itemPoints}
                  </dd>
                </div>
                <div>
                  <dt>Resultado efectivo actual</dt>
                  <dd>
                    {stateLabel(preview.currentStatus)} · {preview.currentPoints}/{itemPoints}
                  </dd>
                </div>
                <div>
                  <dt>Con la versión {preview.rubricVersionNumber}</dt>
                  <dd>
                    {stateLabel(preview.proposedStatus)} · {preview.proposedPoints}/{itemPoints}
                  </dd>
                </div>
                <div>
                  <dt>Diferencia</dt>
                  <dd>
                    {preview.difference > 0 ? "+" : ""}
                    {preview.difference} puntos
                  </dd>
                </div>
                <div>
                  <dt>Total efectivo del desafío</dt>
                  <dd>
                    {preview.currentEffectiveScore} → {preview.newEffectiveScore}
                  </dd>
                </div>
              </dl>
              <form
                action={applyAction}
                className={styles.regradeForm}
                onSubmit={prepareIdempotencyKey}
                aria-busy={applyPending}
              >
                <input type="hidden" name="roomId" value={roomId} readOnly />
                <input
                  type="hidden"
                  name="scheduledChallengeId"
                  value={scheduledChallengeId}
                  readOnly
                />
                <input type="hidden" name="attemptId" value={attemptId} readOnly />
                <input type="hidden" name="challengeItemId" value={challengeItemId} readOnly />
                <input
                  type="hidden"
                  name="rubricQuestionVersionId"
                  value={selectedRubric}
                  readOnly
                />
                <input type="hidden" name="lockVersion" value={lockVersion} readOnly />
                <input type="hidden" name="idempotencyKey" defaultValue="" />
                <FormField
                  id={fieldId + "-reason"}
                  label="Motivo de la corrección"
                  density="compact"
                  required
                >
                  {(field) => (
                    <Textarea {...field} name="reason" rows={3} maxLength={500} required />
                  )}
                </FormField>
                {applyState.message ? <p className={styles.error}>{applyState.message}</p> : null}
                <Button type="submit" disabled={applyPending}>
                  {applyPending ? "Aplicando…" : "Confirmar recálculo"}
                </Button>
              </form>
            </>
          ) : null}
        </>
      )}
    </section>
  );
}
