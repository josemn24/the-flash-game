import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { buttonClassName, type ButtonStyleProps } from "@/components/ui/buttonStyles";

type ButtonContentProps = {
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  children: ReactNode;
};

export type ButtonProps = Omit<ComponentPropsWithoutRef<"button">, "children"> &
  ButtonStyleProps &
  ButtonContentProps & {
    loading?: boolean;
  };

export function Button({
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
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClassName({ variant, size, fullWidth, className })}
    >
      {loading ? <span className="uiButtonSpinner" aria-hidden="true" /> : leadingIcon}
      <span>{children}</span>
      {!loading && trailingIcon}
    </button>
  );
}

export type ButtonLinkProps = Omit<ComponentPropsWithoutRef<typeof Link>, "children"> &
  ButtonStyleProps &
  ButtonContentProps;

export function ButtonLink({
  variant = "primary",
  size = "default",
  fullWidth = false,
  leadingIcon,
  trailingIcon,
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link {...props} className={buttonClassName({ variant, size, fullWidth, className })}>
      {leadingIcon}
      <span>{children}</span>
      {trailingIcon}
    </Link>
  );
}
