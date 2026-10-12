import type { ReactNode } from "react";
import { FormField, Textarea } from "@/components/ui";

type AdminAuditReasonFieldProps = {
  readonly id: string;
  readonly label?: string;
  readonly placeholder?: string;
  readonly error?: ReactNode;
};

export function AdminAuditReasonField({
  id,
  label = "Motivo de auditoría",
  placeholder = "Describe el motivo de la operación",
  error,
}: AdminAuditReasonFieldProps) {
  return (
    <FormField id={id} label={label} density="compact" required error={error} announceError>
      {(field) => (
        <Textarea {...field} name="reason" maxLength={500} rows={2} placeholder={placeholder} />
      )}
    </FormField>
  );
}
