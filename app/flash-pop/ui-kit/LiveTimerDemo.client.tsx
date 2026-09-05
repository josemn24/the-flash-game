"use client";

import { useState } from "react";
import { Button, Timer } from "@/components/ui";
import styles from "./UiKit.module.css";

export function LiveTimerDemo() {
  const [resetKey, setResetKey] = useState(0);
  const [finished, setFinished] = useState(false);

  return (
    <div className={styles.liveTimer}>
      <Timer duration={20} active resetKey={resetKey} onTimeUp={() => setFinished(true)} />
      <div>
        <strong>{finished ? "Tiempo agotado" : "Cuenta atrás real"}</strong>
        <span>Urgencia automática durante el último 25 %.</span>
      </div>
      <Button
        variant="secondary"
        onClick={() => {
          setFinished(false);
          setResetKey((value) => value + 1);
        }}
      >
        Reiniciar
      </Button>
    </div>
  );
}
