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
  size = "md",
  appearance = "default",
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
  const resolvedAppearance = size === "hero" ? "hero" : appearance;

  return (
    <button
      {...props}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      data-variant={variant}
      data-size={size}
      data-appearance={resolvedAppearance}
      className={buttonClassName({
        variant,
        size,
        appearance: resolvedAppearance,
        fullWidth,
        className,
      })}
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
  size = "md",
  appearance = "default",
  fullWidth = false,
  leadingIcon,
  trailingIcon,
  className,
  children,
  ...props
}: ButtonLinkProps) {
  const resolvedAppearance = size === "hero" ? "hero" : appearance;

  return (
    <Link
      {...props}
      data-variant={variant}
      data-size={size}
      data-appearance={resolvedAppearance}
      className={buttonClassName({
        variant,
        size,
        appearance: resolvedAppearance,
        fullWidth,
        className,
      })}
    >
      {leadingIcon}
      <span>{children}</span>
      {trailingIcon}
    </Link>
  );
}
