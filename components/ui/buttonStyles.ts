import styles from "@/components/ui/Button.module.css";

export type ButtonVariant = "primary" | "secondary";
export type ButtonSize = "default" | "hero";

export type ButtonStyleProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
};

export function buttonClassName({
  variant = "primary",
  size = "default",
  className,
}: ButtonStyleProps = {}) {
  return `${styles.button} ${styles[variant]} ${size === "hero" ? styles.hero : ""} ${className ?? ""}`;
}
