import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <div data-surface="private-admin">{children}</div>;
}
