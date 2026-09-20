import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminShell } from "./AdminShell";

describe("AdminShell", () => {
  it("offers an accessible skip link, active navigation and breadcrumbs", () => {
    const markup = renderToStaticMarkup(
      <AdminShell
        operator={{ playerId: "operator-1", displayName: "Operador beta" }}
        activeSection="questions"
        breadcrumbs={[
          { label: "Resumen", href: "/admin" },
          { label: "Preguntas", href: "/admin/questions" },
          { label: "Nueva pregunta" },
        ]}
      >
        <h1>Nueva pregunta</h1>
      </AdminShell>,
    );

    expect(markup).toContain('href="#admin-main-content"');
    expect(markup).toContain('id="admin-main-content"');
    expect(markup).toContain('aria-label="Navegación del portal"');
    expect(markup).toContain('aria-current="page" data-active="true" href="/admin/questions"');
    expect(markup).toContain('aria-label="Migas de pan"');
    expect(markup).toContain("Nueva pregunta");
  });
});
