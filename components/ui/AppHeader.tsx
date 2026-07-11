import type { ReactNode } from "react";

type AppHeaderProps = {
  left: ReactNode;
  right?: ReactNode;
  className?: string;
};

export function AppHeader({ left, right, className }: AppHeaderProps) {
  return (
    <header className={`flex items-center justify-between ${className ?? ""}`}>
      {left}
      {right}
    </header>
  );
}
