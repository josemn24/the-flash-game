"use client";

import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";
import { LinkPendingIndicator } from "@/components/ui/LinkPendingIndicator.client";
import styles from "@/components/ui/LinkPendingIndicator.module.css";

export type PendingLinkProps = ComponentPropsWithoutRef<typeof Link>;

export function PendingLink({ className, children, ...props }: PendingLinkProps) {
  return (
    <Link
      {...props}
      className={className ? `${styles.pendingLink} ${className}` : styles.pendingLink}
    >
      {children}
      <LinkPendingIndicator />
    </Link>
  );
}
