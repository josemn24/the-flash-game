import type { ReactNode } from "react";
import styles from "./Controls.module.css";

export type ChipProps = {
  children: ReactNode;
  icon?: ReactNode;
  variant?: "status" | "data" | "flashPoints";
  tone?: "neutral" | "social" | "info" | "success" | "danger";
  className?: string;
  ariaLabel?: string;
};

export function Chip({
  children,
  icon,
  variant = "status",
  tone = "neutral",
  className,
  ariaLabel,
}: ChipProps) {
  return (
    <span
      className={`${styles.chip} ${styles[variant]} ${variant === "status" ? styles[tone] : ""} ${className ?? ""}`}
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
    >
      {icon}
      <span>{children}</span>
    </span>
  );
}
