import type { ReactNode } from "react";
import styles from "@/components/ui/Badge.module.css";

type BadgeProps = {
  children: ReactNode;
  variant?: "category" | "status";
  dot?: boolean;
  className?: string;
};

export function Badge({ children, variant = "category", dot = false, className }: BadgeProps) {
  return (
    <span className={`${styles.badge} ${styles[variant]} ${className ?? ""}`}>
      {dot && <span className={styles.dot} aria-hidden="true" />}
      {children}
    </span>
  );
}
