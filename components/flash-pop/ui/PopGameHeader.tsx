import type { ReactNode } from "react";
import { BoltIcon } from "@/components/icons";
import { PopTimer } from "./PopTimer";
import styles from "./PopGameHeader.module.css";

export function PopGameHeader({
  title,
  timer,
  action,
  mobileLabel,
  mobileLabelAriaLabel,
}: {
  title: string;
  timer?: ReactNode;
  action?: ReactNode;
  mobileLabel?: ReactNode;
  mobileLabelAriaLabel?: string;
}) {
  return (
    <header className={`${styles.header} ${mobileLabel ? styles.compactOnMobile : ""}`}>
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
      {mobileLabel ? (
        <span className={styles.mobileLabel} aria-label={mobileLabelAriaLabel}>
          {mobileLabel}
        </span>
      ) : null}
      <div className={styles.actions}>
        {timer}
        {action}
      </div>
    </header>
  );
}

export function PopGameTimer({
  duration,
  active,
  onTimeUp,
  resetKey,
}: {
  duration: number;
  active: boolean;
  onTimeUp: () => void;
  resetKey: string | number;
}) {
  return (
    <PopTimer
      duration={duration}
      active={active}
      onTimeUp={onTimeUp}
      resetKey={resetKey}
      size="compact"
    />
  );
}
