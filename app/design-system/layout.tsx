import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isDesignSystemAvailable } from "@/features/design-system/access";

export const metadata: Metadata = {
  title: { default: "Design system — The Flash", template: "%s — The Flash Design System" },
  description: "Guías, componentes reales y demos locales del design system de The Flash.",
  robots: { index: false, follow: false },
};

export default function DesignSystemLayout({ children }: { children: React.ReactNode }) {
  if (!isDesignSystemAvailable(process.env.NODE_ENV)) notFound();
  return children;
}
