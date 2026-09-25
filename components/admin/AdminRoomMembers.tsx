import { Avatar, Card, Chip } from "@/components/ui";
import type { SuperadminRoomMember } from "@/types/view-models";
import { AdminEmptyState } from "./AdminEmptyState";
import { AdminSectionHeader } from "./AdminSectionHeader";
import styles from "./AdminRoomMembers.module.css";

const roleLabels: Record<SuperadminRoomMember["role"], string> = {
  owner: "Propietario",
  admin: "Administrador",
  member: "Miembro",
  spectator: "Espectador",
};

function joinedDate(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeZone }).format(
    new Date(value),
  );
}

export function AdminRoomMembers({
  members,
  timeZone,
}: {
  readonly members: readonly SuperadminRoomMember[];
  readonly timeZone: string;
}) {
  return (
    <section className={styles.section} aria-labelledby="room-members-title">
      <AdminSectionHeader
        id="room-members-title"
        eyebrow="Miembros · solo lectura"
        title="Usuarios activos"
        trailing={
          <Chip variant="data" tone="social">
            {members.length} usuarios
          </Chip>
        }
      />
      {members.length === 0 ? (
        <AdminEmptyState>No hay usuarios activos adicionales en esta sala.</AdminEmptyState>
      ) : (
        <div className={styles.grid}>
          {members.map((member) => (
            <Card as="article" surface="soft" key={member.playerId} className={styles.member}>
              <div className={styles.identity}>
                <Avatar name={member.displayName} src={member.avatarSrc} size="md" tone="social" />
                <div className={styles.copy}>
                  <h3>{member.displayName}</h3>
                  <p>{member.email ?? "Sin email disponible"}</p>
                </div>
              </div>
              <div className={styles.meta}>
                <Chip variant="status" tone="neutral">
                  {roleLabels[member.role]}
                </Chip>
                <span>Desde {joinedDate(member.joinedAt, timeZone)}</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
