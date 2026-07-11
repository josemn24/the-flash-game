"use client";

import { motion, type HTMLMotionProps } from "motion/react";
import styles from "@/components/ui/Button.module.css";

type ButtonProps = HTMLMotionProps<"button"> & {
  variant?: "primary" | "secondary";
  size?: "default" | "hero";
};

export function Button({
  variant = "primary",
  size = "default",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <motion.button
      {...props}
      type={type}
      className={`${styles.button} ${styles[variant]} ${size === "hero" ? styles.hero : ""} ${className ?? ""}`}
    />
  );
}
