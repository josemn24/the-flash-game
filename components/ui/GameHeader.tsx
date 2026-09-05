import type { ReactNode } from "react";
import { BoltIcon } from "./icons";
import styles from "./GameHeader.module.css";

export type GameHeaderProps = {
  left?: ReactNode;
  right?: ReactNode;
  title?: string;
  timer?: ReactNode;
  action?: ReactNode;
  mobileLabel?: ReactNode;
  mobileLabelAriaLabel?: string;
  className?: string;
};

export function GameHeader({
  left,
  right,
  title,
  timer,
  action,
  mobileLabel,
  mobileLabelAriaLabel,
  className,
}: GameHeaderProps) {
  const branded = !left && Boolean(title);

  return (
    <header
      className={`${styles.header} ${mobileLabel ? styles.compactOnMobile : ""} ${className ?? ""}`}
    >
      {branded ? (
        <div className={styles.brand} aria-label="Flash Pop">
          <span className={styles.brandMark}>
            <BoltIcon />
          </span>
          <span className={styles.brandName}>Flash Pop</span>
          <span className={styles.separator} aria-hidden="true">
            /
          </span>
          <span className={styles.title}>{title}</span>
        </div>
      ) : (
        <div className={styles.customLeft}>{left}</div>
      )}
      {mobileLabel ? (
        <span className={styles.mobileLabel} aria-label={mobileLabelAriaLabel}>
          {mobileLabel}
        </span>
      ) : null}
      <div className={styles.actions}>
        {right ?? (
          <>
            {timer}
            {action}
          </>
        )}
      </div>
    </header>
  );
}
