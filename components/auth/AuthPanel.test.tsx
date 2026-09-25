import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AuthPanel } from "./AuthPanel.client";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("AuthPanel", () => {
  it("only exposes the private sign-in flow", () => {
    const markup = renderToStaticMarkup(<AuthPanel />);

    expect(markup).toContain("Entra a jugar");
    expect(markup).toContain("Iniciar sesión");
    expect(markup).toContain('id="auth-email"');
    expect(markup).toContain('id="auth-password"');
    expect(markup).not.toContain("Crea una cuenta");
    expect(markup).not.toContain("Crear cuenta");
    expect(markup).not.toContain("Nombre visible");
  });
});
