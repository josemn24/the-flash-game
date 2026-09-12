import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import styles from "./Controls.module.css";

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> & {
  label: string;
  variant?: "surface" | "social";
  children: ReactNode;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, variant = "surface", className, children, type = "button", ...props },
  ref,
) {
  return (
    <button
      {...props}
      ref={ref}
      type={type}
      aria-label={label}
      className={`${styles.iconButton} ${variant === "social" ? styles.iconSocial : styles.iconSurface} ${className ?? ""}`}
    >
      {children}
    </button>
  );
});
