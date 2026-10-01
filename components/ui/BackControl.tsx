"use client";

import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentPropsWithoutRef } from "react";
import { LinkPendingIndicator } from "./LinkPendingIndicator.client";
import pendingStyles from "./LinkPendingIndicator.module.css";
import { ArrowIcon } from "./icons";
import styles from "./BackControl.module.css";

type BackControlLabelProps = {
  label: string;
  className?: string;
};

export type BackLinkProps = Omit<ComponentPropsWithoutRef<typeof Link>, "aria-label" | "children"> &
  BackControlLabelProps;

export function BackLink({ label, className, ...props }: BackLinkProps) {
  return (
    <Link
      {...props}
      aria-label={label}
      className={`${pendingStyles.pendingLink} ${styles.backControl} ${className ?? ""}`}
    >
      <ArrowIcon className={styles.backIcon} />
      <LinkPendingIndicator />
    </Link>
  );
}

export type BackButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "aria-label" | "children"
> &
  BackControlLabelProps;

export function BackButton({ label, className, type = "button", ...props }: BackButtonProps) {
  return (
    <button
      {...props}
      type={type}
      aria-label={label}
      className={`${styles.backControl} ${className ?? ""}`}
    >
      <ArrowIcon className={styles.backIcon} />
    </button>
  );
}
