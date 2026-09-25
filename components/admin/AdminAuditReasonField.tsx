import type { ReactNode } from "react";

type AdminAuditReasonFieldProps = {
  readonly label?: string;
  readonly placeholder?: string;
  readonly error?: ReactNode;
};

export function AdminAuditReasonField({ label = "Motivo de auditoría", placeholder = "Describe el motivo de la operación", error }: AdminAuditReasonFieldProps) {
  return (
    <label>
      <span>{label}</span>
      <textarea name="reason" maxLength={500} rows={2} required placeholder={placeholder} />
      {error ? <small role="alert">{error}</small> : null}
    </label>
  );
}
