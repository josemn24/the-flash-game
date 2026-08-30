import type { ReactNode } from "react";
import { BoltIcon } from "@/components/icons";
import { PopTimer } from "./PopTimer";
import styles from "./PopGameHeader.module.css";

export function PopGameHeader({
  title,
  timer,
  action,
}: {
  title: string;
  timer?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className={styles.header}>
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
