import { ButtonLink, Card, Chip } from "@/components/ui";
import type { SuperadminDashboardModel } from "@/types/view-models";
import Link from "next/link";
import { AdminShell } from "./AdminShell";
import styles from "./AdminDashboard.module.css";

type AdminDashboardProps = {
  readonly model: SuperadminDashboardModel;
};

const metricLinks = {
  activeRooms: "/admin/rooms",
  activeSeasons: "/admin/rooms",
  pendingSeasons: "/admin/rooms",
  editorialDrafts: "/admin/challenges",
  upcomingChallenges: "/admin/rooms",
} as const;

const metricLabels = {
  activeRooms: "Salas activas",
  activeSeasons: "Temporadas activas",
  pendingSeasons: "Temporadas pendientes",
  editorialDrafts: "Borradores de desafíos",
  upcomingChallenges: "Próximos desafíos",
} as const;

function formatChallengeWindow(opensAt: string, closesAt: string, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  });
  return `${formatter.format(new Date(opensAt))} → ${formatter.format(new Date(closesAt))}`;
}

export function AdminDashboard({ model }: AdminDashboardProps) {
  const metricEntries = Object.entries(model.metrics) as Array<
    [keyof typeof model.metrics, number]
  >;

  return (
    <AdminShell operator={model.operator} activeSection="overview">
      <section className={styles.hero} aria-labelledby="admin-dashboard-title">
        <p className={styles.eyebrow}>Superadministración</p>
        <h1 id="admin-dashboard-title">Todo listo para operar.</h1>
        <p>
          Un resumen del estado de la beta y accesos directos a las operaciones que requieren
          atención.
        </p>
      </section>

      <section className={styles.metrics} aria-labelledby="admin-metrics-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>Estado actual</p>
            <h2 id="admin-metrics-title">En una mirada</h2>
          </div>
        </div>
        <div className={styles.metricGrid}>
          {metricEntries.map(([key, value]) => (
            <ButtonLink
              href={metricLinks[key]}
              variant="secondary"
              className={styles.metricCard}
              key={key}
            >
              <span className={styles.metricValue}>{value}</span>
              <span className={styles.metricLabel}>{metricLabels[key]}</span>
            </ButtonLink>
          ))}
        </div>
      </section>

      <div className={styles.columns}>
        <section className={styles.panel} aria-labelledby="admin-alerts-title">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>Atención operativa</p>
              <h2 id="admin-alerts-title">Alertas</h2>
            </div>
            <Chip variant="data" tone={model.alerts.length > 0 ? "info" : "social"}>
              {model.alerts.length}
            </Chip>
          </div>
          {model.alerts.length > 0 ? (
            <div className={styles.alertList}>
              {model.alerts.map((alert) => (
                <Card as="article" surface="soft" key={alert.id} className={styles.alert}>
                  <Chip variant="status" tone={alert.tone === "warning" ? "danger" : "info"}>
                    {alert.tone === "warning" ? "Atención" : "Información"}
                  </Chip>
                  <h3>{alert.title}</h3>
                  <p>{alert.description}</p>
                  <ButtonLink href={alert.href} variant="secondary" size="sm">
                    {alert.actionLabel}
                  </ButtonLink>
                </Card>
              ))}
            </div>
          ) : (
            <Card as="section" surface="soft" className={styles.emptyPanel}>
              <h3>No hay alertas operativas.</h3>
              <p>El portal no detecta bloqueos inmediatos.</p>
            </Card>
          )}
        </section>

        <section className={styles.panel} aria-labelledby="admin-actions-title">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>Accesos directos</p>
              <h2 id="admin-actions-title">Nueva operación</h2>
            </div>
          </div>
          <div className={styles.actionList}>
            {model.actions.map((action) => (
              <ButtonLink href={action.href} variant="primary" key={action.id}>
                {action.label}
              </ButtonLink>
            ))}
          </div>
        </section>
      </div>

      <section className={styles.section} aria-labelledby="admin-dashboard-rooms-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>Contexto operativo</p>
            <h2 id="admin-dashboard-rooms-title">Salas</h2>
          </div>
          <ButtonLink href="/admin/rooms" variant="secondary" size="sm">
            Ver salas
          </ButtonLink>
        </div>
        {model.rooms.length > 0 ? (
          <div className={styles.roomGrid}>
            {model.rooms.map((room) => (
              <Link
                href={`/admin/rooms/${room.roomId}`}
                key={room.roomId}
                className={styles.roomLink}
              >
                <Card as="article" surface="soft" className={styles.roomCard}>
                  <div className={styles.roomTopline}>
                    <h3>{room.title}</h3>
                    <Chip variant="status" tone="success">
                      Activa
                    </Chip>
                  </div>
                  <p className={styles.muted}>
                    /{room.slug} · {room.seasonCount} temporadas
                  </p>
                  <p className={styles.roomSeason}>
                    {room.activeSeason
                      ? `Temporada activa: ${room.activeSeason.title}`
                      : "Sin temporada activa"}
                  </p>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card as="section" surface="soft" className={styles.emptyPanel}>
            <h3>Aún no hay salas activas.</h3>
            <p>Usa el acceso directo para crear la primera sala.</p>
          </Card>
        )}
      </section>

      <section className={styles.section} aria-labelledby="admin-upcoming-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>Programación</p>
            <h2 id="admin-upcoming-title">Próximos desafíos</h2>
          </div>
          <ButtonLink href="/admin/rooms" variant="secondary" size="sm">
            Ver salas
          </ButtonLink>
        </div>
        {model.upcomingChallenges.length > 0 ? (
          <div className={styles.challengeList}>
            {model.upcomingChallenges.map((challenge) => (
              <Link
                href={`/admin/rooms/${challenge.roomId}?tab=calendar`}
                key={challenge.scheduledChallengeId}
                className={styles.challengeLink}
              >
                <Card as="article" surface="soft" className={styles.challenge}>
                  <div>
                    <p className={styles.eyebrow}>
                      {challenge.roomTitle} · {challenge.seasonTitle}
                    </p>
                    <h3>
                      #{challenge.number} · {challenge.challengeTitle}
                    </h3>
                    <p className={styles.muted}>
                      {formatChallengeWindow(
                        challenge.opensAt,
                        challenge.closesAt,
                        challenge.timeZone,
                      )}
                    </p>
                  </div>
                  <Chip variant="status" tone={challenge.status === "open" ? "success" : "info"}>
                    {challenge.status === "open" ? "Abierto" : "Programado"}
                  </Chip>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card as="section" surface="soft" className={styles.emptyPanel}>
            <h3>No hay desafíos próximos.</h3>
            <p>Programa contenido publicado desde el calendario.</p>
          </Card>
        )}
      </section>
    </AdminShell>
  );
}
