import { PopTheme } from "@/components/flash-pop/PopTheme";

export default function FlashPopLayout({ children }: { children: React.ReactNode }) {
  return <PopTheme>{children}</PopTheme>;
}
