import type { ReactNode } from "react";
import styles from "./AdminSectionHeader.module.css";

type AdminSectionHeaderProps = {
  readonly eyebrow: string;
  readonly title: string;
  readonly id?: string;
  readonly description?: string;
  readonly trailing?: ReactNode;
};

export function AdminSectionHeader({ eyebrow, title, id, description, trailing }: AdminSectionHeaderProps) {
  return (
    <div className={styles.root}>
      <div>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h2 id={id}>{title}</h2>
        {description ? <p className={styles.description}>{description}</p> : null}
      </div>
      {trailing ? <div className={styles.trailing}>{trailing}</div> : null}
    </div>
  );
}
