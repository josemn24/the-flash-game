import { Fredoka, IBM_Plex_Mono, Manrope } from "next/font/google";
import type { Metadata } from "next";
import { RoomSessionProvider } from "@/features/rooms/RoomSessionProvider.client";
import "./globals.css";

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

export const metadata: Metadata = {
  title: "The Flash — Trivia a contrarreloj",
  description: "Diez preguntas. Poco tiempo. Cero excusas.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      className={`${manrope.variable} ${fredoka.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <RoomSessionProvider>{children}</RoomSessionProvider>
      </body>
    </html>
  );
}
