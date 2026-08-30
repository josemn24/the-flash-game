import { motion } from "motion/react";
import { CheckIcon } from "@/components/icons";
import type { QuestionVariant } from "@/types/game";
import styles from "@/components/AnswerOption.module.css";

type AnswerOptionProps = {
  label: string;
  selected?: boolean;
  disabled: boolean;
  index: number;
  onSelect: () => void;
  variant?: QuestionVariant;
};

export function AnswerOption({
  label,
  selected,
  disabled,
  index,
  onSelect,
  variant,
}: AnswerOptionProps) {
  const shortcut = String.fromCharCode(65 + index);

  return (
    <motion.button
      type="button"
      className={`${styles.option} ${selected ? styles.selected : ""} ${variant === "flash-pop" ? styles.pop : ""}`}
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      data-variant={variant ?? "default"}
      whileHover={disabled ? undefined : { x: 4 }}
      whileTap={disabled ? undefined : { scale: 0.985 }}
    >
      <span className={styles.key} aria-hidden="true">
        {selected ? <CheckIcon className="h-4 w-4" /> : shortcut}
      </span>
      <span className={styles.label}>{label}</span>
    </motion.button>
  );
}
