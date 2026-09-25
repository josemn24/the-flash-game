import Link from "next/link";
import { ArrowIcon, Avatar, Button, Canvas, UserPlusIcon } from "@/components/ui";
import type { RoomSettingsModel } from "@/types/game";
import { RoomMemberActions } from "./RoomMemberActions.client";
import styles from "./FlashPopRoomSettings.module.css";

const roleLabels = {
  owner: "Propietario",
  admin: "Admin",
  member: "",
  spectator: "Espectador",
} as const;

export function FlashPopRoomSettings({ model }: { model: RoomSettingsModel }) {
  return (
    <Canvas as="div" contentClassName={styles.content}>
      <section className={styles.hero} aria-labelledby="room-settings-title">
        <header className={styles.heroToolbar}>
          <Link
            href={`/salas/${model.roomId}`}
            className={styles.backButton}
            aria-label="Volver al detalle de la sala"
          >
            <ArrowIcon className={styles.backIcon} />
          </Link>
          <Button
            variant="secondary"
            size="sm"
            disabled
            leadingIcon={<UserPlusIcon />}
            aria-label="Invitar a la sala, próximamente"
          >
            Invitar
          </Button>
        </header>

        <div className={styles.heroContent}>
          <div
            className={styles.memberHero}
            aria-label={`${model.memberCount} miembros de ${model.title}`}
          >
            {model.members.map((member, index) => (
              <Avatar
                key={member.id}
                name={member.name}
                src={member.avatarSrc}
                initials={member.initials}
                tone={member.isCurrentUser ? "social" : index % 2 === 0 ? "blue" : "coral"}
                size={member.isCurrentUser ? "lg" : "md"}
                className={styles.heroAvatar}
              />
            ))}
          </div>
          <p className={styles.memberCount}>{model.memberCount} miembros</p>
          <h1 id="room-settings-title">{model.title}</h1>
        </div>
      </section>

      <div className={styles.body}>
        <section className={styles.membersSection} aria-labelledby="members-title">
          <div className={styles.sectionHeading}>
            <h2 id="members-title">Miembros</h2>
            <span>{model.memberCount}</span>
          </div>
          <ul className={styles.memberList}>
            {model.members.map((member) => (
              <li
                key={member.id}
                className={`${styles.memberRow} ${member.isCurrentUser ? styles.currentMember : ""}`}
              >
                <Avatar
                  name={member.name}
                  src={member.avatarSrc}
                  initials={member.initials}
                  tone={member.isCurrentUser ? "social" : "blue"}
                  size="sm"
                />
                <span className={styles.memberName}>
                  <span className={styles.memberNameLine}>
                    <strong>{member.name}</strong>
                    {roleLabels[member.role] ? (
                      <span className={styles.memberRole}>{roleLabels[member.role]}</span>
                    ) : null}
                    {member.isCurrentUser ? <span className={styles.memberYou}>Tú</span> : null}
                  </span>
                  <small
                    className={styles.memberPoints}
                    role="img"
                    aria-label={`${member.totalFlashPoints} Flash Points`}
                  >
                    {member.totalFlashPoints} ⚡
                  </small>
                </span>
                {model.canManageMembers && member.canManage ? (
                  <RoomMemberActions
                    roomKey={model.roomId}
                    targetMemberKey={member.id}
                    targetName={member.name}
                    role={member.role}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Canvas>
  );
}
