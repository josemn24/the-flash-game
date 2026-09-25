import styles from "./AdminFormError.module.css";

export function AdminFormError({ message }: { readonly message?: string | null }) {
  return message ? <p className={styles.root} role="alert" data-admin-form-error>{message}</p> : null;
}
