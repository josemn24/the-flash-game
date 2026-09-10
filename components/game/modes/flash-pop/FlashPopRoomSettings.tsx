import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowIcon,
  Avatar,
  BellIcon,
  Button,
  Canvas,
  ChevronIcon,
  PencilIcon,
  UserPlusIcon,
} from "@/components/ui";
import type { RoomSettingsModel } from "@/types/game";
import styles from "./FlashPopRoomSettings.module.css";

function SettingsAction({
  label,
  icon,
}: {
  label: string;
  icon: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled
      className={styles.actionButton}
      aria-label={`${label}, próximamente`}
    >
      <span className={styles.actionIcon} aria-hidden="true">
        {icon}
      </span>
      <span>{label}</span>
      <ChevronIcon className={styles.actionChevron} aria-hidden="true" />
    </button>
  );
}

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
          <div className={styles.memberHero} aria-label={`${model.memberCount} miembros de ${model.title}`}>
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
        <section className={styles.actions} aria-labelledby="room-actions-title">
          <h2 id="room-actions-title">Acciones</h2>
          <SettingsAction label="Editar perfil" icon={<PencilIcon />} />
          <SettingsAction label="Notificaciones" icon={<BellIcon />} />
        </section>

        <section className={styles.membersSection} aria-labelledby="members-title">
          <div className={styles.sectionHeading}>
            <h2 id="members-title">Miembros</h2>
            <span>{model.memberCount}</span>
          </div>
          <ul className={styles.memberList}>
            {model.members.map((member, index) => (
              <li
                key={member.id}
                className={`${styles.memberRow} ${member.isCurrentUser ? styles.currentMember : ""}`}
              >
                <span className={styles.memberRank}>{index + 1}</span>
                <Avatar
                  name={member.name}
                  src={member.avatarSrc}
                  initials={member.initials}
                  tone={member.isCurrentUser ? "social" : "blue"}
                  size="sm"
                />
                <span className={styles.memberName}>
                  <strong>{member.name}</strong>
                  <small>{member.totalPoints} Flash Points</small>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Canvas>
  );
}
