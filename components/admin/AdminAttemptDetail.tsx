import { Avatar, Card, Chip } from "@/components/ui";
import type { SuperadminAttemptInspectionModel } from "@/types/view-models";
import { AdminEmptyState } from "./AdminEmptyState";
import { AdminAttemptActions } from "./AdminAttemptActions.client";
import { AdminShell } from "./AdminShell";
import styles from "./AdminAttemptInspection.module.css";

function date(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(value),
      )
    : "—";
}

function statusTone(status: SuperadminAttemptInspectionModel["attempt"]["status"]) {
  return status === "invalidated"
    ? ("danger" as const)
    : status === "completed"
      ? ("success" as const)
      : ("neutral" as const);
}

function pretty(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export function AdminAttemptDetail({
  model,
  updated,
}: {
  readonly model: SuperadminAttemptInspectionModel;
  readonly updated?: boolean;
}) {
  const { attempt, publication } = model;
  return (
    <AdminShell
      operator={model.operator}
      activeSection="rooms"
      breadcrumbs={[
        { label: "Resumen", href: "/admin" },
        { label: "Salas", href: "/admin/rooms" },
        { label: publication.roomTitle, href: `/admin/rooms/${model.roomId}` },
        {
          label: "Intentos",
          href: `/admin/rooms/${model.roomId}/attempts/${publication.scheduledChallengeId}`,
        },
        { label: attempt.displayName },
      ]}
    >
      {updated ? (
        <Card as="section" surface="soft" role="status">
          La operación se ha aplicado y la inspección se ha actualizado.
        </Card>
      ) : null}
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Inspección de intento · {publication.challengeTitle}</p>
          <h1>{attempt.displayName}</h1>
          <p className={styles.meta}>
            {attempt.email ?? "Sin email disponible"} · intento {attempt.attemptNumber}
          </p>
        </div>
        <Chip variant="status" tone={statusTone(attempt.status)}>
          {attempt.status}
        </Chip>
      </header>
      <section className={styles.section} aria-labelledby="attempt-summary-title">
        <div className={styles.heading}>
          <div>
            <p className={styles.eyebrow}>Resultado</p>
            <h2 id="attempt-summary-title">Estado persistido</h2>
          </div>
          <Avatar name={attempt.displayName} src={attempt.avatarSrc} size="md" tone="social" />
        </div>
        <div className={styles.summary}>
          <Card as="article" surface="soft" className={styles.summaryCard}>
            <span className={styles.label}>Original</span>
            <strong>{attempt.originalScore ?? "—"}</strong>
          </Card>
          <Card as="article" surface="soft" className={styles.summaryCard}>
            <span className={styles.label}>Efectiva</span>
            <strong>{attempt.effectiveScore}</strong>
          </Card>
          <Card as="article" surface="soft" className={styles.summaryCard}>
            <span className={styles.label}>Inicio</span>
            <strong>{date(attempt.startedAt)}</strong>
          </Card>
          <Card as="article" surface="soft" className={styles.summaryCard}>
            <span className={styles.label}>Fin</span>
            <strong>{date(attempt.completedAt)}</strong>
          </Card>
        </div>
        <Card as="section" surface="soft">
          <p className={styles.meta}>
            Versión jugada: {publication.challengeVersionId} · lock version {attempt.lockVersion}
          </p>
          {attempt.terminalReason ? (
            <p className={styles.meta}>Motivo terminal: {attempt.terminalReason}</p>
          ) : null}
        </Card>
      </section>
      <section className={styles.section} aria-labelledby="attempt-actions-title">
        <div className={styles.heading}>
          <div>
            <p className={styles.eyebrow}>Operación</p>
            <h2 id="attempt-actions-title">Corregir con motivo</h2>
          </div>
        </div>
        <AdminAttemptActions
          roomId={model.roomId}
          scheduledChallengeId={publication.scheduledChallengeId}
          attemptId={attempt.attemptId}
          lockVersion={attempt.lockVersion}
          status={attempt.status}
          effectiveScore={attempt.effectiveScore}
        />
      </section>
      <section className={styles.section} aria-labelledby="attempt-items-title">
        <div className={styles.heading}>
          <div>
            <p className={styles.eyebrow}>Evidencia</p>
            <h2 id="attempt-items-title">Respuestas por ítem</h2>
          </div>
          <Chip variant="data" tone="social">
            {model.items.length} ítems
          </Chip>
        </div>
        {model.items.length === 0 ? (
          <AdminEmptyState>No hay respuestas evaluadas todavía.</AdminEmptyState>
        ) : (
          <div className={styles.itemList}>
            {model.items.map((item) => (
              <Card
                as="article"
                surface="soft"
                className={styles.itemCard}
                key={item.challengeItemId}
              >
                <div className={styles.rowTopline}>
                  <strong>
                    Ítem {item.position} · {item.questionType}
                  </strong>
                  <Chip variant="status" tone={item.status === "correct" ? "success" : "neutral"}>
                    {item.status ?? "Sin respuesta"}
                  </Chip>
                </div>
                <p className={styles.meta}>
                  {item.awardedPoints ?? 0}/{item.itemPoints} puntos · {item.timeUsedMs ?? 0} ms
                </p>
                <details>
                  <summary>Ver payloads</summary>
                  <pre>
                    {pretty({
                      publicPayload: item.publicPayload,
                      answer: item.answer,
                      resultDetails: item.resultDetails,
                    })}
                  </pre>
                </details>
              </Card>
            ))}
          </div>
        )}
      </section>
      <section className={styles.detailGrid}>
        <div className={styles.section}>
          <div className={styles.heading}>
            <div>
              <p className={styles.eyebrow}>Ledger</p>
              <h2>Movimientos</h2>
            </div>
          </div>
          {model.ledger.length === 0 ? (
            <AdminEmptyState>Sin movimientos de puntos.</AdminEmptyState>
          ) : (
            <div className={styles.ledgerList}>
              {model.ledger.map((entry) => (
                <Card as="article" surface="soft" className={styles.ledgerCard} key={entry.entryId}>
                  <div className={styles.rowTopline}>
                    <strong>{entry.entryType}</strong>
                    <Chip variant="data" tone={entry.amount < 0 ? "danger" : "success"}>
                      {entry.amount > 0 ? "+" : ""}
                      {entry.amount}
                    </Chip>
                  </div>
                  <p className={styles.meta}>
                    {entry.reason ?? "Acreditación original"} · {date(entry.createdAt)}
                  </p>
                  <p className={styles.meta}>{entry.createdByDisplayName ?? "Sistema"}</p>
                </Card>
              ))}
            </div>
          )}
        </div>
        <div className={styles.section}>
          <div className={styles.heading}>
            <div>
              <p className={styles.eyebrow}>Auditoría</p>
              <h2>Historial operativo</h2>
            </div>
          </div>
          {model.audit.length === 0 ? (
            <AdminEmptyState>Sin entradas de auditoría para este intento.</AdminEmptyState>
          ) : (
            <div className={styles.auditList}>
              {model.audit.map((entry) => (
                <Card as="article" surface="soft" className={styles.auditCard} key={entry.auditId}>
                  <strong>{entry.action}</strong>
                  <p className={styles.meta}>
                    {entry.actorDisplayName ?? "Sistema"} · {date(entry.createdAt)}
                  </p>
                  <p className={styles.meta}>{entry.reason ?? "Sin motivo"}</p>
                  <details>
                    <summary>Ver cambios</summary>
                    <pre>
                      {pretty({
                        before: entry.beforePayload,
                        after: entry.afterPayload,
                        requestId: entry.requestId,
                      })}
                    </pre>
                  </details>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>
    </AdminShell>
  );
}
