"use client";

import { motion, type HTMLMotionProps } from "motion/react";
import { buttonClassName, type ButtonStyleProps } from "@/components/ui/buttonStyles";

export type MotionButtonProps = HTMLMotionProps<"button"> & ButtonStyleProps;

export function MotionButton({
  variant = "primary",
  size = "md",
  appearance = "default",
  fullWidth = false,
  className,
  type = "button",
  ...props
}: MotionButtonProps) {
  const resolvedAppearance = size === "hero" ? "hero" : appearance;

  return (
    <motion.button
      {...props}
      type={type}
      data-variant={variant}
      data-size={size}
      data-appearance={resolvedAppearance}
      className={buttonClassName({
        variant,
        size,
        appearance: resolvedAppearance,
        fullWidth,
        className,
      })}
    />
  );
}
