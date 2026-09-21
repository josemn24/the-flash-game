import { describe, expect, it } from "vitest";
import manifest from "./manifest";

describe("PWA manifest", () => {
  it("describes the installable The Flash application", () => {
    expect(manifest()).toMatchObject({
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
    });

    expect(manifest().icons).toEqual([
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
    ]);
  });
});
