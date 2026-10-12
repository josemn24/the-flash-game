import type { EditorialActionState } from "@/app/admin/editorial-actions";
import { FormField, Textarea } from "@/components/ui";
import type { SuperadminEditorialContext } from "@/types/view-models/editorial";
import { useId } from "react";
import styles from "../EditorialManagement.module.css";

export function ErrorMessage({ state }: { readonly state: EditorialActionState }) {
  if (!state.message) return null;
  const details = [
    ...new Set(
      Object.entries(state.fieldErrors ?? {})
        .filter(([key]) => key !== "form")
        .map(([, message]) => message),
    ),
  ];
  return (
    <p className={styles.error} role="alert">
      {state.message}
      {details.length > 0 ? ` ${details.join(" ")}` : ""}
    </p>
  );
}

export function ReasonField() {
  const fieldId = useId();
  return (
    <FormField id={fieldId + "-reason"} label="Motivo de auditoría" density="compact" required>
      {(field) => (
        <Textarea
          {...field}
          name="reason"
          maxLength={500}
          rows={2}
          placeholder="Preparar contenido de la beta"
        />
      )}
    </FormField>
  );
}

export function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function statusLabel(status: SuperadminEditorialContext["entries"][number]["status"]) {
  if (status === "draft") return "Borrador";
  if (status === "published") return "Publicado";
  return "Archivado";
}

export function statusTone(status: SuperadminEditorialContext["entries"][number]["status"]) {
  if (status === "draft") return "info" as const;
  if (status === "published") return "success" as const;
  return "neutral" as const;
}
