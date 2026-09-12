import type { ReactNode } from "react";
import styles from "./Controls.module.css";

export type ChipProps = {
  children: ReactNode;
  icon?: ReactNode;
  variant?: "status" | "data" | "reward";
  tone?: "neutral" | "social" | "info" | "success" | "danger";
  className?: string;
};

export function Chip({
  children,
  icon,
  variant = "status",
  tone = "neutral",
  className,
}: ChipProps) {
  return (
    <span
      className={`${styles.chip} ${styles[variant]} ${variant === "status" ? styles[tone] : ""} ${className ?? ""}`}
    >
      {icon}
      <span>{children}</span>
    </span>
  );
}
