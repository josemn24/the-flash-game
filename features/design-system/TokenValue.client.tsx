"use client";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import styles from "./TokenValue.module.css";

export function TokenValue({ token, color = false }: { token: string; color?: boolean }) {
  const probe = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState("…");
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const computed =
        color && probe.current
          ? getComputedStyle(probe.current).backgroundColor
          : getComputedStyle(document.documentElement).getPropertyValue(token).trim();
      setValue(computed || "Sin valor");
    });
    return () => cancelAnimationFrame(frame);
  }, [token, color]);
  return (
    <>
      <span
        ref={probe}
        hidden
        style={color ? ({ backgroundColor: `var(${token})` } as CSSProperties) : undefined}
      />
      <output className={styles.value} data-token-value={token}>
        {value}
      </output>
    </>
  );
}
