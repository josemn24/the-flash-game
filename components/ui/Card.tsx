import type { HTMLAttributes, ReactNode } from "react";
import styles from "./Card.module.css";

export type CardProps = HTMLAttributes<HTMLElement> & {
  as?: "div" | "section" | "article";
  surface?: "surface" | "soft";
  elevation?: "flat" | "card" | "hero";
  padding?: "none" | "compact" | "default";
  density?: "none" | "compact" | "default";
  children: ReactNode;
};

export function Card({
  as: Component = "div",
  surface = "surface",
  elevation = "card",
  padding = "default",
  density,
  className,
  children,
  ...props
}: CardProps) {
  const resolvedDensity = density ?? padding;

  return (
    <Component
      {...props}
      data-surface={surface}
      data-elevation={elevation}
      data-density={resolvedDensity}
      className={`${styles.card} ${styles[surface]} ${elevation === "card" ? styles.cardElevation : styles[elevation]} ${styles[resolvedDensity]} ${className ?? ""}`}
    >
      {children}
    </Component>
  );
}
