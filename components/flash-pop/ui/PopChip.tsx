import type { ReactNode } from "react";
import styles from "./PopControls.module.css";

type PopChipBaseProps = {
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
};

export type PopChipProps = PopChipBaseProps &
  (
    | {
        variant?: "status";
        tone?: "neutral" | "social" | "info" | "success" | "danger";
      }
    | { variant: "data"; tone?: never }
    | { variant: "reward"; tone?: never }
  );

export function PopChip(props: PopChipProps) {
  const { children, icon, className } = props;
  const variant = props.variant ?? "status";
  const tone = variant === "status" ? (props.tone ?? "neutral") : variant;

  return (
    <span className={`${styles.chip} ${styles[variant]} ${styles[tone]} ${className ?? ""}`}>
      {icon}
      <span>{children}</span>
    </span>
  );
}
