"use client";

import { useLinkStatus } from "next/link";
import styles from "./LinkPendingIndicator.module.css";

export function LinkPendingIndicator() {
  const { pending } = useLinkStatus();

  return (
    <span
      className={styles.indicator}
      data-pending={pending ? "true" : undefined}
      aria-hidden="true"
    />
  );
}
