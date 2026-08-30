import Image from "next/image";
import styles from "./PopAvatar.module.css";

export type PopAvatarTone = "social" | "coral" | "blue" | "aqua" | "ink" | "reward";
export type PopAvatarSize = "sm" | "md" | "lg";

export type PopAvatarProps = {
  name: string;
  src?: string;
  initials?: string;
  tone?: PopAvatarTone;
  size?: PopAvatarSize;
  className?: string;
};

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.at(0)?.toLocaleUpperCase("es") ?? "")
    .join("");
}

export function PopAvatar({
  name,
  src,
  initials,
  tone = "social",
  size = "md",
  className,
}: PopAvatarProps) {
  return (
    <span
      className={`${styles.avatar} ${styles[size]} ${styles[tone]} ${className ?? ""}`}
      role="img"
      aria-label={name}
    >
      {src ? (
        <Image src={src} alt="" fill sizes="56px" className={styles.image} />
      ) : (
        <span aria-hidden="true">{initials ?? getInitials(name)}</span>
      )}
    </span>
  );
}

export type PopAvatarData = Omit<PopAvatarProps, "size" | "className"> & { id: string };

export type PopAvatarStackProps = {
  items: PopAvatarData[];
  label: string;
  maxVisible?: number;
  size?: PopAvatarSize;
  className?: string;
};

export function PopAvatarStack({
  items,
  label,
  maxVisible = 4,
  size = "sm",
  className,
}: PopAvatarStackProps) {
  const visible = items.slice(0, Math.max(0, maxVisible));
  const overflow = Math.max(0, items.length - visible.length);

  return (
    <span className={`${styles.group} ${className ?? ""}`} aria-label={label}>
      <span className={styles.stack} aria-hidden="true">
        {visible.map(({ id, ...avatar }) => (
          <PopAvatar {...avatar} key={id} size={size} className={styles.stackedAvatar} />
        ))}
        {overflow > 0 ? (
          <PopAvatar
            name={`${overflow} personas más`}
            initials={`+${overflow}`}
            tone="ink"
            size={size}
            className={styles.stackedAvatar}
          />
        ) : null}
      </span>
      <span className={styles.label}>{label}</span>
    </span>
  );
}
