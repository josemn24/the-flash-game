import { Button } from "@/components/ui";
import styles from "./ServerOperationStatus.module.css";

export type ServerOperationState = "idle" | "submitting" | "error";

export type ServerOperationStatusProps = {
  readonly state: ServerOperationState;
  readonly visible: boolean;
  readonly pendingMessage: string;
  readonly errorMessage?: string;
  readonly retryLabel: string;
  readonly onRetry?: () => void;
};

export function ServerOperationStatus({
  state,
  visible,
  pendingMessage,
  errorMessage,
  retryLabel,
  onRetry,
}: ServerOperationStatusProps) {
  if (state === "idle") return null;
  const contentVisible = state === "error" || visible;

  return (
    <div
      className={styles.root}
      aria-busy={state === "submitting"}
      role="status"
      aria-live="polite"
      aria-atomic={state === "error" ? "true" : undefined}
    >
      {contentVisible ? (
        <div className={state === "error" ? styles.error : styles.pending}>
          {state === "submitting" ? <span className={styles.spinner} aria-hidden="true" /> : null}
          <p>
            {state === "submitting"
              ? pendingMessage
              : (errorMessage ?? "No se ha podido completar la operación.")}
          </p>
          {state === "error" && onRetry ? (
            <Button type="button" variant="secondary" size="sm" onClick={onRetry}>
              {retryLabel}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
