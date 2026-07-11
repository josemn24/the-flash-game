import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Flash — Trivia a contrarreloj",
  description: "Diez preguntas. Poco tiempo. Cero excusas.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
