import { motion } from "motion/react";

export function ProgressBar({ current, total }: { current: number; total: number }) {
  const percentage = (current / total) * 100;

  return (
    <div
      className="h-1.5 overflow-hidden rounded-full bg-white/10"
      role="progressbar"
      aria-label="Progreso de la etapa"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={current}
    >
      <motion.div
        className="h-full rounded-full bg-[linear-gradient(90deg,var(--electric),var(--cyan))] shadow-[0_0_14px_rgba(212,255,0,.55)]"
        initial={false}
        animate={{ width: `${percentage}%` }}
        transition={{ type: "spring", stiffness: 120, damping: 22 }}
      />
    </div>
  );
}
