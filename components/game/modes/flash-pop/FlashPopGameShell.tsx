"use client";

import type { ReactNode } from "react";
import { AnimatePresence, MotionConfig } from "motion/react";
import { Canvas } from "@/components/ui";
import styles from "./FlashPopGameShell.module.css";

type FlashPopGameShellProps = {
  layout: "intro" | "game";
  children: ReactNode;
};

export function FlashPopGameShell({ layout, children }: FlashPopGameShellProps) {
  return (
    <MotionConfig reducedMotion="user">
      <Canvas
        data-gameplay-shell="flash-pop"
        data-gameplay-layout={layout}
        maxWidth={layout === "intro" ? "none" : "wide"}
        contentClassName={layout === "intro" ? styles.introCanvasContent : styles.screen}
      >
        <AnimatePresence mode="wait">{children}</AnimatePresence>
      </Canvas>
    </MotionConfig>
  );
}
