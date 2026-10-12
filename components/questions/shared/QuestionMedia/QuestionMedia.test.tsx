import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { QuestionMedia } from "./QuestionMedia";

describe("QuestionMedia image sources", () => {
  it("serves proxied signed Storage images directly", () => {
    const signedUrl =
      "/__local-supabase/storage/v1/object/sign/question-assets/image.png?token=test";
    const markup = renderToStaticMarkup(
      <QuestionMedia media={{ type: "image", src: signedUrl, alt: "Imagen privada" }} />,
    );
    expect(markup).toContain(`src="${signedUrl}"`);
    expect(markup).not.toContain("/_next/image");
  });
  it("serves signed remote images directly instead of through Next image optimization", () => {
    const signedUrl =
      "http://127.0.0.1:54321/storage/v1/object/sign/question-assets/image.png?token=test";
    const markup = renderToStaticMarkup(
      <QuestionMedia media={{ type: "image", src: signedUrl, alt: "Imagen privada" }} />,
    );

    expect(markup).toContain(`src="${signedUrl}"`);
    expect(markup).not.toContain("/_next/image");
  });

  it("keeps local visual paths optimized", () => {
    const markup = renderToStaticMarkup(
      <QuestionMedia
        media={{
          type: "image",
          src: "/visuals/connections/eiffel-tower.png",
          alt: "Monumento",
        }}
      />,
    );

    expect(markup).toContain("/_next/image");
  });

  it.each(["/visuals/icon.svg", "/visuals/icon.svg?version=2"])(
    "serves SVG images directly: %s",
    (src) => {
      const markup = renderToStaticMarkup(
        <QuestionMedia media={{ type: "image", src, alt: "Icono" }} />,
      );

      expect(markup).toContain(`src="${src}"`);
      expect(markup).not.toContain("/_next/image");
    },
  );
});
