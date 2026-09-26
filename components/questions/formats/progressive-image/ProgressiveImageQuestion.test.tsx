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
  it("serves signed remote images directly in every environment", () => {
    const signedUrl =
      "https://example.supabase.co/storage/v1/object/sign/question-assets/image.png?token=test";
    const markup = renderToStaticMarkup(
      <ProgressiveImageQuestion
        {...baseProps}
        surface={{ src: signedUrl, alt: "Imagen privada", width: 1200, height: 800 }}
      />,
    );

    expect(markup).toContain(`src="${signedUrl}"`);
    expect(markup).not.toContain("/_next/image");
  });
});
