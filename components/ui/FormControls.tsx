import type { ComponentPropsWithRef, ReactNode } from "react";
import styles from "./FormControls.module.css";

export type FormDensity = "comfortable" | "compact";
export type InputProps = ComponentPropsWithRef<"input"> & { density?: FormDensity };
export type SelectProps = ComponentPropsWithRef<"select"> & { density?: FormDensity };
export type TextareaProps = ComponentPropsWithRef<"textarea"> & {
  density?: FormDensity;
  font?: "ui" | "mono";
};

export function Input({ density = "comfortable", className, ...props }: InputProps) {
  return (
    <input {...props} data-density={density} className={`${styles.control} ${className ?? ""}`} />
  );
}

export function Select({ density = "comfortable", className, ...props }: SelectProps) {
  return (
    <select {...props} data-density={density} className={`${styles.control} ${className ?? ""}`} />
  );
}

export function Textarea({
  density = "comfortable",
  font = "ui",
  className,
  ...props
}: TextareaProps) {
  return (
    <textarea
      {...props}
      data-density={density}
      data-font={font}
      className={`${styles.control} ${styles.textarea} ${className ?? ""}`}
    />
  );
}

export type FieldControlProps = {
  id: string;
  density: FormDensity;
  required?: boolean;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
};

export type FormFieldProps = {
  id: string;
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  invalid?: boolean;
  required?: boolean;
  density?: FormDensity;
  describedBy?: string;
  announceError?: boolean;
  className?: string;
  children: (props: FieldControlProps) => ReactNode;
};

function hasContent(content: ReactNode) {
  return content !== undefined && content !== null && content !== false && content !== "";
}

export function FormField({
  id,
  label,
  description,
  error,
  invalid = false,
  required,
  density = "comfortable",
  describedBy,
  announceError = false,
  className,
  children,
}: FormFieldProps) {
  const hasDescription = hasContent(description);
  const hasError = hasContent(error);
  const descriptionIds = [
    ...new Set([
      ...(describedBy?.split(/\s+/).filter(Boolean) ?? []),
      ...(hasDescription ? [`${id}-help`] : []),
      ...(hasError ? [`${id}-error`] : []),
    ]),
  ].join(" ");
  return (
    <div className={`${styles.field} ${className ?? ""}`} data-density={density}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {children({
        id,
        density,
        required,
        "aria-invalid": invalid || hasError ? true : undefined,
        "aria-describedby": descriptionIds || undefined,
      })}
      {hasDescription ? (
        <div id={`${id}-help`} className={styles.description}>
          {description}
        </div>
      ) : null}
      {hasError ? (
        <div id={`${id}-error`} className={styles.error} role={announceError ? "alert" : undefined}>
          {error}
        </div>
      ) : null}
    </div>
  );
}
