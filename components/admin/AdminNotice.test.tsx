import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminNotice } from "./AdminNotice";

describe("AdminNotice", () => {
  it("announces successful operations politely", () => {
    const markup = renderToStaticMarkup(
      <AdminNotice title="Sala creada correctamente." description="Ya está disponible." />,
    );

    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain("Sala creada correctamente.");
  });
});
