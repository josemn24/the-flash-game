import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ServerOperationStatus } from "./ServerOperationStatus";

const baseProps = {
  pendingMessage: "Comprobando respuesta…",
  errorMessage: "No hemos podido confirmar tu respuesta.",
  retryLabel: "Reintentar",
};

describe("ServerOperationStatus", () => {
  it("does not render anything while idle", () => {
    expect(
      renderToStaticMarkup(<ServerOperationStatus {...baseProps} state="idle" visible />),
    ).toBe("");
  });

  it("keeps the loading slot quiet before the visibility threshold", () => {
    const markup = renderToStaticMarkup(
      <ServerOperationStatus {...baseProps} state="submitting" visible={false} />,
    );

    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain('role="status"');
    expect(markup).not.toContain("Comprobando respuesta…");
  });

  it("renders an accessible loading message after the threshold", () => {
    const markup = renderToStaticMarkup(
      <ServerOperationStatus {...baseProps} state="submitting" visible />,
    );

    expect(markup).toContain("Comprobando respuesta…");
    expect(markup).toContain('aria-live="polite"');
  });

  it("renders the error and manual retry action", () => {
    const markup = renderToStaticMarkup(
      <ServerOperationStatus {...baseProps} state="error" visible={false} onRetry={vi.fn()} />,
    );

    expect(markup).toContain("No hemos podido confirmar tu respuesta.");
    expect(markup).toContain("Reintentar");
    expect(markup).toContain('aria-atomic="true"');
  });
});
