"use client";

import { motion, type HTMLMotionProps } from "motion/react";
import { buttonClassName, type ButtonStyleProps } from "@/components/ui/buttonStyles";

export type MotionButtonProps = HTMLMotionProps<"button"> & ButtonStyleProps;

export function MotionButton({
  variant = "primary",
  size = "default",
  className,
  type = "button",
  ...props
}: MotionButtonProps) {
  return (
    <motion.button
      {...props}
      type={type}
      className={buttonClassName({ variant, size, className })}
    />
  );
}
