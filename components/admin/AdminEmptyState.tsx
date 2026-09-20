import type { ReactNode } from "react";
import styles from "./AdminEmptyState.module.css";

export function AdminEmptyState({ children }: { readonly children: ReactNode }) {
  return <p className={styles.root} data-admin-empty-state>{children}</p>;
}
