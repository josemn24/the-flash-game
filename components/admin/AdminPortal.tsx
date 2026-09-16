import { LogoutButton } from "@/components/auth/LogoutButton.client";
import { Avatar, BoltIcon, Card, Canvas, Chip } from "@/components/ui";
import type { SuperadminPortalContext } from "@/types/view-models";
import styles from "./AdminPortal.module.css";

type AdminPortalProps = {
  readonly context: SuperadminPortalContext;
};

export function AdminPortal({ context }: AdminPortalProps) {
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
          Esta es la vista privada de la beta. Desde aquí se incorporarán las herramientas para
          preparar salas, grupos y temporadas.
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
    </Canvas>
  );
}
