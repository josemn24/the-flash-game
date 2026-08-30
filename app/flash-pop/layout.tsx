import { Fredoka, IBM_Plex_Mono, Manrope } from "next/font/google";
import themeStyles from "@/components/flash-pop/FlashPopTheme.module.css";

const manrope = Manrope({
  subsets: ["latin"],
  weight: "variable",
  variable: "--font-flash-pop-ui",
  display: "swap",
});

const fredoka = Fredoka({
  subsets: ["latin"],
  weight: "variable",
  axes: ["wdth"],
  variable: "--font-flash-pop-display",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["600", "700"],
  style: "normal",
  variable: "--font-flash-pop-mono",
  display: "swap",
});

export default function FlashPopLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${themeStyles.theme} ${manrope.variable} ${fredoka.variable} ${plexMono.variable}`}
      data-theme="flash-pop"
    >
      {children}
    </div>
  );
}
