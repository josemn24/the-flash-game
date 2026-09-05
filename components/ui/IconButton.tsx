import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./Controls.module.css";

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> & {
  label: string;
  variant?: "surface" | "social";
  children: ReactNode;
};

export function IconButton({
  label,
  variant = "surface",
  className,
  children,
  type = "button",
  ...props
}: IconButtonProps) {
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
