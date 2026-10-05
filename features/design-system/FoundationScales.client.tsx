"use client";
import { useState, type CSSProperties } from "react";
import { Button } from "@/components/ui";
import { TokenValue } from "./TokenValue.client";
import styles from "./Catalog.module.css";

const spaces = ["1", "2", "3", "4", "5", "6", "7", "8", "10", "12"];
const typography = [
  "type-ui",
  "type-display",
  "type-mono",
  "type-display-strong-weight",
  "type-display-strong-tracking",
  "type-display-soft-weight",
  "type-display-soft-tracking",
  "type-display-soft-line-height",
];
const motion = ["motion-press-in", "motion-press-out", "motion-card-enter", "ease-out"];
export function FoundationScales() {
  const [moved, setMoved] = useState(false);
  return (
    <>
      <section>
        <h2>Tokens tipográficos</h2>
        <p>
          Display para títulos, UI para lectura y acciones, mono para datos. Las escalas se
          documentan sin introducir nuevas variantes.
        </p>
        <div className={styles.grid}>
          {typography.map((name) => (
            <div key={name} className={styles.entry}>
              <code>--{name}</code>
              <TokenValue token={`--${name}`} />
            </div>
          ))}
        </div>
      </section>
      <section id="espaciado">
        <h2>Espaciado y controles</h2>
        <div className={styles.geometry}>
          {spaces.map((step) => (
            <div key={step} className={styles.geometrySample}>
              <code>--space-{step}</code>
              <i
                className={styles.spacingSample}
                style={{ "--sample-space": `var(--space-${step})` } as CSSProperties}
              />
              <TokenValue token={`--space-${step}`} />
            </div>
          ))}
        </div>
        <div className={styles.grid}>
          {["control-height", "control-height-hero", "control-height-icon"].map((name) => (
            <div key={name} className={styles.entry}>
              <code>--{name}</code>
              <TokenValue token={`--${name}`} />
            </div>
          ))}
        </div>
        <p>
          Usar la escala existente para agrupar contenido y mantener la densidad. Las excepciones
          locales se revisarán en una siguiente fase.
        </p>
      </section>
      <section id="movimiento">
        <h2>Movimiento</h2>
        <div className={styles.grid}>
          {motion.map((name) => (
            <div key={name} className={styles.entry}>
              <code>--{name}</code>
              <TokenValue token={`--${name}`} />
            </div>
          ))}
        </div>
        <div className={styles.demo}>
          <span
            className={`${styles.motionSample} ${moved ? styles.motionMoved : ""}`}
            aria-hidden="true"
          />
          <div className={styles.row}>
            <Button variant="secondary" onClick={() => setMoved((value) => !value)}>
              Alternar movimiento
            </Button>
            <Button variant="secondary" onClick={() => setMoved(false)}>
              Reiniciar movimiento
            </Button>
          </div>
          <p className={styles.caption}>
            La preferencia de movimiento reducido elimina la transición mediante la regla global
            existente.
          </p>
        </div>
      </section>
    </>
  );
}
