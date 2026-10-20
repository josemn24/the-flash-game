"use client";
import { useActionState, useId } from "react";
import Link from "next/link";
import { associateRehearsal } from "@/app/admin/rehearsal-actions";
import { Button, Card, FormField, Input, Select } from "@/components/ui";
import type { RehearsalRef } from "@/types/gameplay/rehearsal";
import { randomUuid } from "@/lib/randomUuid";

export type RehearsalEditorModel = {
  challengeVersionId: string;
  status: "draft" | "published" | "archived";
  updatedAt: string;
  ref: RehearsalRef | null;
  choices: readonly { ref: RehearsalRef; title: string; issues: readonly string[] }[];
};
export function RehearsalManagement({
  versions,
}: {
  versions: readonly (RehearsalEditorModel & { versionNumber: number })[];
}) {
  return (
    <section aria-label="Ensayos del desafío">
      <h2>Pruebas sin competir</h2>
      <p>
        El ensayo es opcional. Su contenido se mantiene en el repositorio y su asociación queda
        fijada al publicar.
      </p>
      {versions.map((version) => (
        <RehearsalVersion
          key={`${version.challengeVersionId}:${version.updatedAt}:${version.ref?.contentHash ?? "none"}`}
          model={version}
        />
      ))}
    </section>
  );
}
function RehearsalVersion({ model }: { model: RehearsalEditorModel & { versionNumber: number } }) {
  const id = useId();
  const [state, action, pending] = useActionState(associateRehearsal, {});
  const frozen = model.status !== "draft" && model.ref !== null;
  return (
    <Card as="article">
      <h3>Ensayo de la versión {model.versionNumber}</h3>
      {model.ref ? (
        <p>
          Asociado: {model.ref.id} · v{model.ref.version}
        </p>
      ) : null}
      <form
        action={action}
        onSubmit={(event) => {
          const field = event.currentTarget.elements.namedItem(
            "idempotencyKey",
          ) as HTMLInputElement;
          field.value = randomUuid();
        }}
      >
        <input type="hidden" name="idempotencyKey" defaultValue="" />
        <input type="hidden" name="challengeVersionId" value={model.challengeVersionId} readOnly />
        <input type="hidden" name="expectedUpdatedAt" value={model.updatedAt} readOnly />
        <FormField id={`${id}-choice`} label="Ensayo compatible">
          {(field) => (
            <Select
              {...field}
              name="rehearsal"
              disabled={frozen || pending}
              defaultValue={model.ref ? `${model.ref.id}@${model.ref.version}` : ""}
            >
              <option value="">Sin ensayo</option>
              {model.choices.map((choice) => (
                <option
                  key={`${choice.ref.id}@${choice.ref.version}`}
                  value={`${choice.ref.id}@${choice.ref.version}`}
                  disabled={choice.issues.length > 0}
                >
                  {choice.title} · v{choice.ref.version}
                  {choice.issues.length ? " · No compatible" : ""}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        {!frozen ? (
          <>
            <FormField id={`${id}-reason`} label="Motivo">
              {(field) => (
                <Input {...field} name="reason" required maxLength={500} disabled={pending} />
              )}
            </FormField>
            <Button type="submit" loading={pending}>
              Guardar asociación
            </Button>
          </>
        ) : (
          <p>Esta asociación está publicada y no se puede sustituir.</p>
        )}
        {state.error ? <p role="alert">{state.error}</p> : null}
        {state.message ? <p role="status">{state.message}</p> : null}
      </form>
      <details>
        <summary>Compatibilidad y vista previa</summary>
        <ul>
          {model.choices.map((choice) => (
            <li key={`${choice.ref.id}@${choice.ref.version}`}>
              <Link
                href={`/admin/rehearsals/${choice.ref.id}/${choice.ref.version}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {choice.title} · v{choice.ref.version}
              </Link>
              {choice.issues.length ? (
                <p>{choice.issues.join(". ")}</p>
              ) : (
                <p>Estructura compatible.</p>
              )}
            </li>
          ))}
        </ul>
      </details>
    </Card>
  );
}
