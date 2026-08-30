import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./PopControls.module.css";

export type PopIconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> & {
  label: string;
  variant?: "surface" | "social";
  children: ReactNode;
};

export function PopIconButton({
  label,
  variant = "surface",
  className,
  children,
  type = "button",
  ...props
}: PopIconButtonProps) {
  return (
    <button
      {...props}
      type={type}
      aria-label={label}
      className={`${styles.iconButton} ${variant === "social" ? styles.iconSocial : styles.iconSurface} ${className ?? ""}`}
    >
      {children}
    </button>
  );
}
