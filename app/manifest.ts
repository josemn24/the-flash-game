import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "The Flash — Trivia a contrarreloj",
    short_name: "The Flash",
    description: "Diez preguntas. Poco tiempo. Cero excusas.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    lang: "es",
    background_color: "#f4f1ea",
    theme_color: "#d7ff19",
    icons: [
      {
        src: "/icons/the-flash-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/the-flash-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
