"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import styles from "./KeyboardGameLayout.module.css";

const DockTarget = createContext<HTMLDivElement | null>(null);

/** Keeps the game's actions outside the scrolling question without moving its state. */
export function KeyboardGameLayout({
  header,
  children,
  contained = false,
}: {
  header: ReactNode;
  children: ReactNode;
  contained?: boolean;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [dock, setDock] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const host = contained ? (frame.closest("dialog") ?? frame) : frame;
    const viewport = window.visualViewport;
    const syncViewport = () => {
      const height = viewport?.height ?? window.innerHeight;
      frame.toggleAttribute("data-compact-keyboard", height <= 480);
      host.style.setProperty("--keyboard-viewport-height", `${height}px`);
      host.style.setProperty("--keyboard-viewport-top", `${viewport?.offsetTop ?? 0}px`);
    };
    syncViewport();
    viewport?.addEventListener("resize", syncViewport);
    viewport?.addEventListener("scroll", syncViewport);
    window.addEventListener("resize", syncViewport);
    return () => {
      viewport?.removeEventListener("resize", syncViewport);
      viewport?.removeEventListener("scroll", syncViewport);
      window.removeEventListener("resize", syncViewport);
      host.style.removeProperty("--keyboard-viewport-height");
      host.style.removeProperty("--keyboard-viewport-top");
    };
  }, [contained]);

  return (
    <DockTarget.Provider value={dock}>
      <div
        ref={frameRef}
        className={`${styles.frame} ${contained ? styles.contained : ""}`}
        data-keyboard-layout={contained ? "contained" : "viewport"}
      >
        <div className={styles.header}>{header}</div>
        <div className={styles.scroll} data-keyboard-scroll>
          {children}
        </div>
        <div ref={setDock} className={styles.dock} data-keyboard-dock />
      </div>
    </DockTarget.Provider>
  );
}

export function KeyboardGameDock({ children }: { children: ReactNode }) {
  const target = useContext(DockTarget);
  return target ? createPortal(children, target) : children;
}
