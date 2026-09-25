import Link from "next/link";
import { Avatar, Card, Chip, ButtonLink } from "@/components/ui";
import type { SuperadminAttemptListModel } from "@/types/view-models";
import { AdminEmptyState } from "./AdminEmptyState";
import { AdminShell } from "./AdminShell";
import styles from "./AdminAttemptInspection.module.css";

function statusLabel(status: SuperadminAttemptListModel["attempts"][number]["status"]) {
  return {
    in_progress: "En curso",
    completed: "Completado",
    abandoned: "Abandonado",
    invalidated: "Invalidado",
  }[status];
}

function statusTone(status: SuperadminAttemptListModel["attempts"][number]["status"]) {
  return status === "invalidated"
    ? ("danger" as const)
    : status === "completed"
      ? ("success" as const)
      : ("neutral" as const);
}

function date(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(value),
      )
    : "—";
}

export function AdminAttemptList({ model }: { readonly model: SuperadminAttemptListModel }) {
  const { publication } = model;
  return (
    <AdminShell
      operator={model.operator}
      activeSection="rooms"
      breadcrumbs={[
        { label: "Resumen", href: "/admin" },
        { label: "Salas", href: "/admin/rooms" },
        { label: publication.roomTitle, href: `/admin/rooms/${model.roomId}` },
        { label: "Intentos" },
        { label: publication.challengeTitle },
      ]}
    >
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>
            Desafío {publication.number} · {publication.mode}
          </p>
          <h1>{publication.challengeTitle}</h1>
          <p className={styles.meta}>
            Versión {publication.versionNumber} · {publication.seasonTitle}
          </p>
        </div>
        <ButtonLink href={`/admin/rooms/${model.roomId}/attempts`} variant="secondary" size="sm">
          Cambiar desafío
        </ButtonLink>
      </header>
      <section className={styles.section} aria-labelledby="attempt-list-title">
        <div className={styles.heading}>
          <div>
            <p className={styles.eyebrow}>Intentos competitivos</p>
            <h2 id="attempt-list-title">Participación de usuarios</h2>
          </div>
          <Chip variant="data" tone="social">
            {model.attempts.length} mostrados
          </Chip>
        </div>
        {model.attempts.length === 0 ? (
          <AdminEmptyState>Ningún usuario ha iniciado este desafío.</AdminEmptyState>
        ) : (
          <Card as="section" surface="soft" className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Estado</th>
                  <th>Original</th>
                  <th>Efectiva</th>
                  <th>Inicio</th>
                  <th aria-label="Acción" />
                </tr>
              </thead>
              <tbody>
                {model.attempts.map((attempt) => (
                  <tr key={attempt.attemptId}>
                    <td>
                      <div className={styles.identity}>
                        <Avatar
                          name={attempt.displayName}
                          src={attempt.avatarSrc}
                          size="sm"
                          tone="social"
                        />
                        <div>
                          <strong>{attempt.displayName}</strong>
                          <span>{attempt.outcome ?? "Sin outcome"}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <Chip variant="status" tone={statusTone(attempt.status)}>
                        {statusLabel(attempt.status)}
                      </Chip>
                    </td>
                    <td>{attempt.originalScore ?? "—"}</td>
                    <td>{attempt.effectiveScore}</td>
                    <td>{date(attempt.startedAt)}</td>
                    <td>
                      <Link
                        className={styles.attemptLink}
                        href={`/admin/rooms/${model.roomId}/attempts/${publication.scheduledChallengeId}/${attempt.attemptId}`}
                      >
                        Inspeccionar
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
        {model.nextCursor ? (
          <div className={styles.pagination}>
            <ButtonLink
              href={`/admin/rooms/${model.roomId}/attempts/${publication.scheduledChallengeId}?cursorAt=${encodeURIComponent(model.nextCursor.startedAt)}&cursorId=${model.nextCursor.attemptId}`}
              variant="secondary"
              size="sm"
            >
              Ver más intentos
            </ButtonLink>
          </div>
        ) : null}
      </section>
    </AdminShell>
  );
}
