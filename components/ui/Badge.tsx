import type { ReactNode } from "react";
import { Chip } from "@/components/ui/Chip";

type BadgeProps = {
  children: ReactNode;
  variant?: "category" | "status";
  dot?: boolean;
  className?: string;
};

export function Badge({ children, dot = false, className }: BadgeProps) {
  return (
    <Chip
      variant="status"
      icon={dot ? <span aria-hidden="true">•</span> : undefined}
      className={className}
    >
      {children}
    </Chip>
  );
}
