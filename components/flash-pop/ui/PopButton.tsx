import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import styles from "./PopControls.module.css";

export type PopButtonVariant = "primary" | "secondary";
export type PopButtonSize = "default" | "hero";

type PopButtonStyleProps = {
  variant?: PopButtonVariant;
  size?: PopButtonSize;
  fullWidth?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  className?: string;
  children: ReactNode;
};

function buttonClassName({
  variant = "primary",
  size = "default",
  fullWidth = false,
  className,
}: Pick<PopButtonStyleProps, "variant" | "size" | "fullWidth" | "className">) {
  return [
    styles.button,
    styles[variant],
    size === "hero" ? styles.hero : "",
    fullWidth ? styles.fullWidth : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
}

export type PopButtonProps = Omit<ComponentPropsWithoutRef<"button">, "children"> &
  PopButtonStyleProps & {
    loading?: boolean;
  };

export function PopButton({
  variant = "primary",
  size = "default",
  fullWidth = false,
  leadingIcon,
  trailingIcon,
  loading = false,
  disabled,
  className,
  children,
  type = "button",
  ...props
}: PopButtonProps) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClassName({ variant, size, fullWidth, className })}
    >
      {loading ? <span className={styles.spinner} aria-hidden="true" /> : leadingIcon}
      <span>{children}</span>
      {!loading && trailingIcon}
    </button>
  );
}

export type PopButtonLinkProps = Omit<ComponentPropsWithoutRef<typeof Link>, "children"> &
  PopButtonStyleProps;

export function PopButtonLink({
  variant = "primary",
  size = "default",
  fullWidth = false,
  leadingIcon,
  trailingIcon,
  className,
  children,
  ...props
}: PopButtonLinkProps) {
  return (
    <Link {...props} className={buttonClassName({ variant, size, fullWidth, className })}>
      {leadingIcon}
      <span>{children}</span>
      {trailingIcon}
    </Link>
  );
}
