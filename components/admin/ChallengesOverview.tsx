import Link from "next/link";
import { Card, Chip } from "@/components/ui";
import type { SuperadminChallengeSummary } from "@/types/view-models";
import { AdminEmptyState } from "./AdminEmptyState";
import { AdminSectionHeader } from "./AdminSectionHeader";
import styles from "./ChallengesOverview.module.css";

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

function statusLabel(summary: SuperadminChallengeSummary) {
  if (summary.statusCounts.draft > 0) return "Borrador";
  if (summary.statusCounts.published > 0) return "Publicado";
  return "Archivado";
}

function statusTone(summary: SuperadminChallengeSummary) {
  if (summary.statusCounts.draft > 0) return "info" as const;
  if (summary.statusCounts.published > 0) return "success" as const;
  return "neutral" as const;
}

export function ChallengesOverview({
  challenges,
}: {
  readonly challenges: readonly SuperadminChallengeSummary[];
}) {
  return (
    <section className={styles.section} aria-labelledby="challenges-overview-title">
      <AdminSectionHeader
        id="challenges-overview-title"
        eyebrow="S11 · catálogo editorial"
        title="Desafíos"
        description="Versiones Flash definidas y listas para revisar o programar."
        trailing={
          <Chip variant="data" tone="social">
            {challenges.length} desafíos
          </Chip>
        }
      />

      {challenges.length > 0 ? (
        <div className={styles.grid}>
          {challenges.map((challenge) => (
            <Link
              href={`/admin/challenges/${challenge.challengeDefinitionId}`}
              key={challenge.challengeDefinitionId}
              className={styles.link}
              aria-label={`Abrir desafío ${challenge.title}`}
            >
              <Card as="article" surface="soft" className={styles.card}>
                <div className={styles.topline}>
                  <p className={styles.eyebrow}>
                    {challenge.mode} · {challenge.slug}
                  </p>
                  <Chip variant="status" tone={statusTone(challenge)}>
                    {statusLabel(challenge)}
                  </Chip>
                </div>
                <h3>{challenge.title}</h3>
                {challenge.subtitle ? (
                  <p className={styles.subtitle}>{challenge.subtitle}</p>
                ) : null}
                <div className={styles.meta}>
                  <span>{challenge.questionCount} preguntas</span>
                  <span>
                    {challenge.versionCount}{" "}
                    {challenge.versionCount === 1 ? "versión" : "versiones"}
                  </span>
                </div>
                <p className={styles.updated}>
                  Actualizado {formatTimestamp(challenge.updatedAt)} UTC
                </p>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card as="section" surface="soft" className={styles.empty}>
          <h3>Aún no hay desafíos Flash.</h3>
          <AdminEmptyState>
            Prepara el primer desafío para poder publicarlo y programarlo en una sala.
          </AdminEmptyState>
          <Link href="/admin/challenges/new" className={styles.emptyLink}>
            Crear un desafío
          </Link>
        </Card>
      )}

      {challenges.length > 0 ? (
        <Link href="/admin/challenges/new" className={styles.createLink}>
          Crear nuevo desafío
        </Link>
      ) : null}
    </section>
  );
}
