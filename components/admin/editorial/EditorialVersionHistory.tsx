import type { EditorialActionState } from "@/app/admin/editorial-actions";
import { Button, Card, Chip, FormField, Select } from "@/components/ui";
import type {
  SuperadminChallengeVersionComparison,
  SuperadminEditorialContext,
} from "@/types/view-models/editorial";
import Link from "next/link";
import type { FormEvent } from "react";
import styles from "../EditorialManagement.module.css";
import { ComparisonPanel } from "./EditorialComparison";
import {
  ErrorMessage,
  ReasonField,
  formatTimestamp,
  statusLabel,
  statusTone,
} from "./EditorialFormFields";
export function EditorialVersionHistory({
  fieldId,
  context,
  comparison,
  revisionAction,
  revisionState,
  revisionPending,
  onRevisionSubmit,
  archiveAction,
  archiveState,
  archivePending,
  onArchiveSubmit,
}: {
  readonly fieldId: string;
  readonly context: SuperadminEditorialContext;
  readonly comparison?: SuperadminChallengeVersionComparison | null;
  readonly revisionAction: (data: FormData) => void;
  readonly revisionState: EditorialActionState;
  readonly revisionPending: boolean;
  readonly onRevisionSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly archiveAction: (data: FormData) => void;
  readonly archiveState: EditorialActionState;
  readonly archivePending: boolean;
  readonly onArchiveSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const historicalEntries = context.entries.filter((entry) => entry.status !== "draft");
  const challengeDefinitionId = context.entries[0]?.challengeDefinitionId ?? "";
  return (
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
                    onSubmit={(event) => onRevisionSubmit(event)}
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
                        onArchiveSubmit(event);
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
  );
}
