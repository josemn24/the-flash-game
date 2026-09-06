import { BoltIcon } from "@/components/ui";
import styles from "./Logo.module.css";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="inline-flex items-center gap-2" aria-label="The Flash">
      <span className={styles.brandMark}>
        <BoltIcon className="h-4 w-4" />
      </span>
      {!compact && <span className={styles.brandLabel}>The Flash</span>}
    </div>
  );
}
