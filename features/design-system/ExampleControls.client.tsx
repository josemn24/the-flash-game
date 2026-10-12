"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

// Keep demo controls outside the screen's viewport when the example is embedded.
// This also avoids a resize loop for real views whose minimum height is 100dvh.
export function ExampleControls({ id, children }: { id: string; children: ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (!window.frameElement) return;
      setTarget(window.parent.document.getElementById(`example-controls-${id}`));
    });
    return () => cancelAnimationFrame(frame);
  }, [id]);
  return target ? createPortal(children, target) : children;
}
