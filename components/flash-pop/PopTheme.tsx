import type { ReactNode } from "react";
import themeStyles from "./FlashPopTheme.module.css";

export function PopTheme({ children }: { children: ReactNode }) {
  return (
    <div className={themeStyles.theme} data-theme="flash-pop">
      {children}
    </div>
  );
}
