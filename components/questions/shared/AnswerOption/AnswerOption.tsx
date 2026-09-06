import { motion } from "motion/react";
import { CheckIcon } from "@/components/ui";
import styles from "./AnswerOption.module.css";

type AnswerOptionProps = {
  label: string;
  selected?: boolean;
  disabled: boolean;
  index: number;
  onSelect: () => void;
};

export function AnswerOption({
  label,
  selected,
  disabled,
  index,
  onSelect,
}: AnswerOptionProps) {
  const shortcut = String.fromCharCode(65 + index);

  return (
    <motion.button
      type="button"
      className={`${styles.option} ${selected ? styles.selected : ""}`}
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
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
