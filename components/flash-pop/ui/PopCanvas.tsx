import type { HTMLAttributes, ReactNode } from "react";
import styles from "./PopCanvas.module.css";

export type PopCanvasProps = HTMLAttributes<HTMLElement> & {
  as?: "main" | "div" | "section";
  maxWidth?: "wide" | "content" | "none";
  contentClassName?: string;
  children: ReactNode;
};

export function PopCanvas({
  as: Component = "main",
  maxWidth = "wide",
  className,
  contentClassName,
  children,
  ...props
}: PopCanvasProps) {
  const widthClass = maxWidth === "content" ? styles.contentWidth : styles[maxWidth];

  return (
    <Component {...props} className={`${styles.canvas} ${className ?? ""}`}>
      <div className={styles.pattern} aria-hidden="true" />
      <div className={`${styles.content} ${widthClass} ${contentClassName ?? ""}`}>{children}</div>
    </Component>
  );
}
