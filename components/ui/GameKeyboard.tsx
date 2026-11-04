"use client";

import styles from "./GameKeyboard.module.css";

export type GameKeyboardProps = {
  id?: string;
  disabled: boolean;
  includeSpace?: boolean;
  compact?: boolean;
  onKeyPress: (key: string) => void;
  onPreserveFocus: () => void;
};

export function GameKeyboard({
  id,
  disabled,
  includeSpace = false,
  compact = false,
  onKeyPress,
  onPreserveFocus,
}: GameKeyboardProps) {
  const rows = [
    Array.from("QWERTYUIOP"),
    Array.from("ASDFGHJKLÑ"),
    [...(includeSpace ? [" "] : []), ...Array.from("ZXCVBNM"), "Backspace"],
  ];

  return (
    <div
      id={id}
      className={`${styles.keyboard} ${compact ? styles.compact : ""}`}
      role="group"
      aria-label="Teclado del juego"
    >
      {rows.map((row, index) => (
        <div className={styles.row} key={index}>
          {row.map((key) => (
            <button
              type="button"
              key={key}
              className={key === " " || key === "Backspace" ? styles.wideKey : undefined}
              aria-label={
                key === " " ? "Espacio" : key === "Backspace" ? "Borrar último carácter" : key
              }
              disabled={disabled}
              onPointerDown={(event) => {
                event.preventDefault();
                onPreserveFocus();
              }}
              onClick={() => onKeyPress(key)}
            >
              {key === " " ? "␣" : key === "Backspace" ? "⌫" : key}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
