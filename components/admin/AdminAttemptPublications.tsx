import Link from "next/link";
import { Card, Chip } from "@/components/ui";
import type { SuperadminAttemptPublication, SuperadminPortalContext } from "@/types/view-models";
import { AdminEmptyState } from "./AdminEmptyState";
import { AdminShell } from "./AdminShell";
import styles from "./AdminAttemptInspection.module.css";

function modeLabel(mode: SuperadminAttemptPublication["mode"]) {
  return { flash: "Flash", alphabet: "Alphabet", survival: "Supervivencia", pyramid: "Pirámide" }[
    mode
  ];
}

function statusLabel(status: SuperadminAttemptPublication["status"]) {
  return { scheduled: "Programado", open: "Abierto", closed: "Cerrado", cancelled: "Cancelado" }[
    status
  ];
}

export function AdminAttemptPublications({
  operator,
  roomId,
  roomTitle,
  publications,
}: {
  readonly operator: SuperadminPortalContext["operator"];
  readonly roomId: string;
  readonly roomTitle: string;
  readonly publications: readonly SuperadminAttemptPublication[];
}) {
  return (
    <AdminShell
      operator={operator}
      activeSection="rooms"
      breadcrumbs={[
        { label: "Resumen", href: "/admin" },
        { label: "Salas", href: "/admin/rooms" },
        { label: roomTitle },
        { label: "Intentos" },
      ]}
    >
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Inspección operativa</p>
          <h1>Resultados por desafío</h1>
          <p className={styles.meta}>
            Selecciona una publicación para consultar sus intentos competitivos.
          </p>
        </div>
        <Chip variant="status" tone="info">
          Superadmin
        </Chip>
      </header>
      <section className={styles.section} aria-labelledby="attempt-publications-title">
        <div className={styles.heading}>
          <div>
            <p className={styles.eyebrow}>Publicaciones</p>
            <h2 id="attempt-publications-title">Desafíos de la sala</h2>
          </div>
          <Chip variant="data" tone="social">
            {publications.length} desafíos
          </Chip>
        </div>
        {publications.length === 0 ? (
          <AdminEmptyState>
            No hay publicaciones competitivas disponibles para inspeccionar.
          </AdminEmptyState>
        ) : (
          <div className={styles.grid}>
            {publications.map((publication) => (
              <Link
                key={publication.scheduledChallengeId}
                href={`/admin/rooms/${roomId}/attempts/${publication.scheduledChallengeId}`}
                className={styles.cardLink}
              >
                <Card as="article" surface="soft" className={styles.card}>
                  <div className={styles.rowTopline}>
                    <p className={styles.eyebrow}>Desafío {publication.number}</p>
                    <Chip
                      variant="status"
                      tone={publication.status === "cancelled" ? "danger" : "neutral"}
                    >
                      {statusLabel(publication.status)}
                    </Chip>
                  </div>
                  <h3>{publication.challengeTitle}</h3>
                  <p>{publication.challengeSubtitle || "Sin subtítulo"}</p>
                  <p className={styles.meta}>
                    {modeLabel(publication.mode)} · versión {publication.versionNumber}
                  </p>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </AdminShell>
  );
}
