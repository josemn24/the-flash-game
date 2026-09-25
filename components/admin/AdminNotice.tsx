import { Card } from "@/components/ui";
import styles from "./AdminNotice.module.css";

type AdminNoticeProps = {
  readonly title: string;
  readonly description?: string;
};

export function AdminNotice({ title, description }: AdminNoticeProps) {
  return (
    <Card as="section" surface="soft" className={styles.notice} role="status" aria-live="polite">
      <strong>{title}</strong>
      {description ? <span>{description}</span> : null}
    </Card>
  );
}
