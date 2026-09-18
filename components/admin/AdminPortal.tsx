import { LogoutButton } from "@/components/auth/LogoutButton.client";
import { Avatar, BoltIcon, Card, Canvas, Chip } from "@/components/ui";
import type { SuperadminPortalContext } from "@/types/view-models";
import { CreateRoomForm } from "./CreateRoomForm.client";
import { SeasonManagement } from "./SeasonManagement.client";
import { EditorialManagement } from "./EditorialManagement.client";
import { CalendarManagement } from "./CalendarManagement.client";
import { QuestionLibraryManagement } from "./QuestionLibraryManagement.client";
import styles from "./AdminPortal.module.css";

type AdminPortalProps = {
  readonly context: SuperadminPortalContext;
  readonly creationNotice?: boolean;
  readonly seasonNotice?: string;
  readonly editorialNotice?: string;
  readonly calendarNotice?: string;
};

export function AdminPortal({ context, creationNotice = false, seasonNotice, editorialNotice, calendarNotice }: AdminPortalProps) {
  const seasonNoticeText = {
    created: "Borrador de temporada creado.",
    updated: "Borrador de temporada actualizado.",
    activated: "Temporada activada correctamente.",
  }[seasonNotice ?? ""];
  const editorialNoticeText = {
    saved: "Borrador editorial guardado.",
    published: "Versión editorial publicada.",
  }[editorialNotice ?? ""];
  const calendarNoticeText = {
    created: "Publicación programada correctamente.",
    updated: "Publicación reprogramada correctamente.",
  }[calendarNotice ?? ""];

  return (
    <Canvas contentClassName={styles.content}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            <BoltIcon />
          </span>
          <div>
            <p className={styles.eyebrow}>Flash Pop · beta privada</p>
            <p className={styles.brandName}>Portal de operaciones</p>
          </div>
        </div>

        <div className={styles.account}>
          <Avatar
            name={context.operator.displayName}
            initials={context.operator.displayName.slice(0, 2).toUpperCase()}
            tone="social"
            size="sm"
          />
          <div className={styles.accountCopy}>
            <span className={styles.accountLabel}>Operador</span>
            <strong>{context.operator.displayName}</strong>
          </div>
          <LogoutButton />
        </div>
      </header>

      <section className={styles.hero} aria-labelledby="admin-portal-title">
        <p className={styles.eyebrow}>Superadministración</p>
        <h1 id="admin-portal-title">Todo listo para operar.</h1>
        <p>
          Esta es la vista privada de la beta. Desde aquí se preparan salas, grupos y temporadas
          antes de publicar contenido competitivo.
        </p>
      </section>

      <section className={styles.rooms} aria-labelledby="admin-rooms-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>Contexto operativo</p>
            <h2 id="admin-rooms-title">Salas activas</h2>
          </div>
          <Chip variant="data" tone="social">
            {context.rooms.length} {context.rooms.length === 1 ? "sala" : "salas"}
          </Chip>
        </div>

        {context.rooms.length > 0 ? (
          <div className={styles.roomGrid}>
            {context.rooms.map((room, index) => (
              <Card as="article" key={room.roomId} elevation="card" className={styles.roomCard}>
                <div className={styles.roomTopline}>
                  <span className={styles.roomIndex} aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <Chip variant="status" tone="success">
                    Activa
                  </Chip>
                </div>
                <h3>{room.title}</h3>
                <p className={styles.slug}>/{room.slug}</p>
              </Card>
            ))}
          </div>
        ) : (
          <Card as="section" surface="soft" className={styles.emptyState}>
            <BoltIcon aria-hidden="true" />
            <h3>Aún no hay salas activas.</h3>
            <p>Las salas provisionadas para la beta aparecerán aquí.</p>
          </Card>
        )}
      </section>

      <SeasonManagement rooms={context.rooms} />
      <EditorialManagement
        context={context.editorial ?? { entries: [], source: "supabase" }}
        questionLibrary={context.questionLibrary}
      />
      <QuestionLibraryManagement
        library={context.questionLibrary ?? { entries: [], total: 0, page: 1, pageSize: 25, source: "supabase" }}
      />
      <CalendarManagement
        context={context}
        calendar={context.calendar ?? { entries: [], source: "supabase" }}
      />

      {creationNotice ? (
        <Card as="section" surface="soft" className={styles.notice} role="status">
          <strong>Sala creada correctamente.</strong>
          <span>La nueva sala ya aparece en el contexto operativo.</span>
        </Card>
      ) : null}

      {seasonNoticeText ? (
        <Card as="section" surface="soft" className={styles.notice} role="status">
          <strong>{seasonNoticeText}</strong>
          <span>El contexto operativo se ha actualizado.</span>
        </Card>
      ) : null}

      {editorialNoticeText ? (
        <Card as="section" surface="soft" className={styles.notice} role="status">
          <strong>{editorialNoticeText}</strong>
          <span>El catálogo editorial se ha actualizado.</span>
        </Card>
      ) : null}

      {calendarNoticeText ? (
        <Card as="section" surface="soft" className={styles.notice} role="status">
          <strong>{calendarNoticeText}</strong>
          <span>El calendario operativo se ha actualizado.</span>
        </Card>
      ) : null}

      <CreateRoomForm />
    </Canvas>
  );
}
