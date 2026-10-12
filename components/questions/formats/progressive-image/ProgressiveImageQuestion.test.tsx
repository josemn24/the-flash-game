import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ProgressiveImageQuestion } from "./ProgressiveImageQuestion";

const baseProps = {
  revealDuration: 12,
  locked: false,
  onSubmit: vi.fn(),
  onTimedResponseStart: vi.fn(),
};

describe("ProgressiveImageQuestion image sources", () => {
  it.each([
    "https://example.supabase.co/storage/v1/object/sign/question-assets/image.png?token=test",
    "/__local-supabase/storage/v1/object/sign/question-assets/image.png?token=test",
  ])("serves signed images directly: %s", (signedUrl) => {
    const markup = renderToStaticMarkup(
      <ProgressiveImageQuestion
        {...baseProps}
        surface={{ src: signedUrl, alt: "Imagen privada", width: 1200, height: 800 }}
      />,
    );

    expect(markup).toContain(`src="${signedUrl}"`);
    expect(markup).not.toContain("/_next/image");
  });

  it("keeps local raster images optimized", () => {
    const markup = renderToStaticMarkup(
      <ProgressiveImageQuestion
        {...baseProps}
        surface={{ src: "/visuals/photo.png", alt: "Imagen local", width: 1200, height: 800 }}
      />,
    );

    expect(markup).toContain("/_next/image");
  });
});
