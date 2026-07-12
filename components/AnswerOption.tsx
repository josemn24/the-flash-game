import { motion } from "motion/react";
import { CheckIcon } from "@/components/icons";
import styles from "@/components/AnswerOption.module.css";

type AnswerOptionProps = {
  label: string;
  selected?: boolean;
  disabled: boolean;
  index: number;
  onSelect: () => void;
};

export function AnswerOption({ label, selected, disabled, index, onSelect }: AnswerOptionProps) {
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
      <span className="text-left text-[15px] font-bold sm:text-base">{label}</span>
    </motion.button>
  );
}
