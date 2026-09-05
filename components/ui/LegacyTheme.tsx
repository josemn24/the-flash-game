import type { ReactNode } from "react";
import styles from "./LegacyTheme.module.css";

export function LegacyTheme({ children }: { children: ReactNode }) {
  return (
    <div className={styles.theme} data-theme="legacy-dark">
      {children}
    </div>
  );
}
