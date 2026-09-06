import styles from "./Controls.module.css";

export type ButtonVariant = "primary" | "secondary";
export type ButtonAppearance = "default" | "hero";
export type ButtonSize = "sm" | "md" | "lg" | "default" | "hero";

export type ButtonStyleProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  appearance?: ButtonAppearance;
  fullWidth?: boolean;
  className?: string;
};

export function buttonClassName({
  variant = "primary",
  size = "md",
  appearance = "default",
  fullWidth = false,
  className,
}: ButtonStyleProps = {}) {
  const resolvedAppearance = size === "hero" ? "hero" : appearance;
  const resolvedSize =
    size === "default" || size === "hero" ? (size === "hero" ? "lg" : "md") : size;

  return [
    styles.button,
    styles[variant],
    styles[`size${resolvedSize[0].toUpperCase()}${resolvedSize.slice(1)}`],
    resolvedAppearance === "hero" ? styles.hero : "",
    fullWidth ? styles.fullWidth : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
}
