import type { HTMLAttributes, ReactNode } from "react";
import styles from "./Card.module.css";

export type CardProps = HTMLAttributes<HTMLElement> & {
  as?: "div" | "section" | "article";
  surface?: "surface" | "soft";
  elevation?: "flat" | "card" | "hero";
  padding?: "none" | "compact" | "default";
  children: ReactNode;
};

export function Card({
  as: Component = "div",
  surface = "surface",
  elevation = "card",
  padding = "default",
  className,
  children,
  ...props
}: CardProps) {
  return (
    <Component
      {...props}
      className={`${styles.card} ${styles[surface]} ${elevation === "card" ? styles.cardElevation : styles[elevation]} ${styles[padding]} ${className ?? ""}`}
    >
      {children}
    </Component>
  );
}
