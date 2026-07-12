import type { ComponentPropsWithoutRef } from "react";
import { buttonClassName, type ButtonStyleProps } from "@/components/ui/buttonStyles";

export type ButtonProps = ComponentPropsWithoutRef<"button"> & ButtonStyleProps;

export function Button({
  variant = "primary",
  size = "default",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button {...props} type={type} className={buttonClassName({ variant, size, className })} />
  );
}
