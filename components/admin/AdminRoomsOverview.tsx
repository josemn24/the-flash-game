import { ButtonLink, Card, Chip } from "@/components/ui";
import Link from "next/link";
import type { SuperadminPortalRoom } from "@/types/view-models";
import styles from "./AdminRoomsOverview.module.css";

type AdminRoomsOverviewProps = {
  readonly rooms: readonly SuperadminPortalRoom[];
  readonly showAction?: boolean;
};

export function AdminRoomsOverview({ rooms, showAction = false }: AdminRoomsOverviewProps) {
  return (
    <section className={styles.section} aria-labelledby="admin-rooms-overview-title">
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Contexto operativo</p>
          <h2 id="admin-rooms-overview-title">Salas activas</h2>
        </div>
        <Chip variant="data" tone="social">
          {rooms.length} {rooms.length === 1 ? "sala" : "salas"}
        </Chip>
      </div>

      {rooms.length > 0 ? (
        <div className={styles.grid}>
          {rooms.map((room, index) => (
            <Link
              href={`/admin/rooms/${room.roomId}`}
              className={styles.entryLink}
              aria-label={`Ver detalle de ${room.title}`}
              key={room.roomId}
            >
              <Card as="article" elevation="card" className={styles.card}>
                <div className={styles.topline}>
                  <span className={styles.index} aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <Chip variant="status" tone="success">
                    Activa
                  </Chip>
                </div>
                <h3>{room.title}</h3>
                <p className={styles.slug}>/{room.slug}</p>
                <p className={styles.meta}>
                  {room.seasons.length} {room.seasons.length === 1 ? "temporada" : "temporadas"}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card as="section" surface="soft" className={styles.empty}>
          <h3>Aún no hay salas activas.</h3>
          <p>Crea la primera sala privada para empezar a preparar la beta.</p>
        </Card>
      )}

      {showAction ? (
        <ButtonLink href="#crear-sala" variant="secondary" className={styles.action}>
          Crear sala
        </ButtonLink>
      ) : null}
    </section>
  );
}
