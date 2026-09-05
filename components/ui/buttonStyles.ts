import styles from "./Controls.module.css";

export type ButtonVariant = "primary" | "secondary";
export type ButtonSize = "default" | "hero";

export type ButtonStyleProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
};

export function buttonClassName({
  variant = "primary",
  size = "default",
  fullWidth = false,
  className,
}: ButtonStyleProps = {}) {
  return [
    styles.button,
    styles[variant],
    size === "hero" ? styles.hero : "",
    fullWidth ? styles.fullWidth : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
}
