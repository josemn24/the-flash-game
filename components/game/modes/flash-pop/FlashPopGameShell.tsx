"use client";

import type { ReactNode } from "react";
import { AnimatePresence, MotionConfig } from "motion/react";
import { Canvas } from "@/components/ui";
import styles from "./FlashPopGameShell.module.css";

type FlashPopGameShellProps = {
  layout: "intro" | "game";
  presentation?: "default" | "pyramid";
  children: ReactNode;
};

export function FlashPopGameShell({
  layout,
  presentation = "default",
  children,
}: FlashPopGameShellProps) {
  const contentClassName =
    layout === "intro"
      ? styles.introCanvasContent
      : `${styles.screen} ${presentation === "pyramid" ? styles.pyramidScreen : ""}`;

  return (
    <MotionConfig reducedMotion="user">
      <Canvas
        data-gameplay-shell="flash-pop"
        data-gameplay-layout={layout}
        maxWidth={layout === "intro" ? "none" : "wide"}
        contentClassName={contentClassName}
      >
        <AnimatePresence mode="wait">{children}</AnimatePresence>
      </Canvas>
    </MotionConfig>
  );
}
