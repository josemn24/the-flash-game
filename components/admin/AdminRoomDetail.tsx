import { ButtonLink, Card, Chip } from "@/components/ui";
import type { SuperadminRoomDetailModel } from "@/types/view-models";
import Link from "next/link";
import { AdminNotice } from "./AdminNotice";
import { AdminRoomMembers } from "./AdminRoomMembers";
import { AdminShell } from "./AdminShell";
import { CalendarManagement } from "./CalendarManagement.client";
import { SeasonManagement } from "./SeasonManagement.client";
import styles from "./AdminRoomDetail.module.css";

export type AdminRoomTab = "overview" | "seasons" | "members" | "calendar";

function dateRange(startsAt: string, endsAt: string, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeZone });
  return `${formatter.format(new Date(startsAt))} → ${formatter.format(new Date(endsAt))}`;
}

function activeSeason(model: SuperadminRoomDetailModel) {
  return model.room.seasons.find((season) => season.status === "active") ?? null;
}

export function AdminRoomDetail({
  model,
  tab,
  notice,
}: {
  readonly model: SuperadminRoomDetailModel;
  readonly tab: AdminRoomTab;
  readonly notice?: string | null;
}) {
  const season = activeSeason(model);
  const tabs: readonly { id: AdminRoomTab; label: string }[] = [
    { id: "overview", label: "Resumen" },
    { id: "seasons", label: "Temporadas" },
    { id: "members", label: "Usuarios activos" },
    { id: "calendar", label: "Calendario" },
  ];

  return (
    <AdminShell
      operator={model.operator}
      activeSection="rooms"
      breadcrumbs={[
        { label: "Resumen", href: "/admin" },
        { label: "Salas", href: "/admin/rooms" },
        { label: model.room.title },
      ]}
    >
      <header className={styles.hero}>
        <div>
          <h1>{model.room.title}</h1>
          <p className={styles.meta}>{model.room.timeZone}</p>
        </div>
        <Chip variant="status" tone="success">
          Activa
        </Chip>
      </header>

      <nav className={styles.tabs} aria-label={`Secciones de ${model.room.title}`}>
        {tabs.map((item) => (
          <Link
            key={item.id}
            href={`/admin/rooms/${model.room.roomId}?tab=${item.id}`}
            className={`${styles.tab} ${tab === item.id ? styles.tabActive : ""}`}
            aria-current={tab === item.id ? "page" : undefined}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {notice ? (
        <AdminNotice title={notice} description="El contexto de la sala se ha actualizado." />
      ) : null}

      {tab === "overview" ? (
        <section className={styles.overview} aria-labelledby="room-overview-title">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>Estado de la sala</p>
              <h2 id="room-overview-title">Operación actual</h2>
            </div>
            <Chip variant="data" tone="social">
              {model.members.length} usuarios activos
            </Chip>
          </div>
          <div className={styles.summaryGrid}>
            <Card as="article" surface="soft" className={styles.summaryCard}>
              <p className={styles.cardLabel}>Temporada activa</p>
              <h3>{season?.title ?? "Sin temporada activa"}</h3>
              <p>
                {season
                  ? dateRange(season.startsAt, season.endsAt, model.room.timeZone)
                  : "Crea y activa una temporada para programar desafíos."}
              </p>
              <ButtonLink
                href={`/admin/rooms/${model.room.roomId}?tab=seasons`}
                variant="secondary"
                size="sm"
              >
                Gestionar temporadas
              </ButtonLink>
            </Card>
            <Card as="article" surface="soft" className={styles.summaryCard}>
              <p className={styles.cardLabel}>Calendario</p>
              <h3>{model.calendar.entries.length} publicaciones</h3>
              <p>Contenido programado, abierto, cerrado o cancelado en esta sala.</p>
              <ButtonLink
                href={`/admin/rooms/${model.room.roomId}?tab=calendar`}
                variant="secondary"
                size="sm"
              >
                Abrir calendario
              </ButtonLink>
            </Card>
          </div>
        </section>
      ) : null}

      {tab === "seasons" ? <SeasonManagement room={model.room} /> : null}
      {tab === "members" ? (
        <AdminRoomMembers
          roomId={model.room.roomId}
          members={model.members}
          timeZone={model.room.timeZone}
        />
      ) : null}
      {tab === "calendar" ? (
        <CalendarManagement
          room={model.room}
          calendar={model.calendar}
          publishedContent={model.publishedContent}
        />
      ) : null}
    </AdminShell>
  );
}
