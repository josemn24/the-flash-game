import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminNavigation } from "./AdminNavigation";

describe("AdminNavigation", () => {
  it("exposes every canonical section and marks the active route", () => {
    const markup = renderToStaticMarkup(<AdminNavigation activeSection="challenges" />);

    expect(markup).toContain('href="/admin"');
    expect(markup).toContain('href="/admin/rooms"');
    expect(markup).toContain('aria-current="page" data-active="true" href="/admin/challenges"');
    expect(markup).toContain("Desafíos");
    expect(markup).not.toContain("Contenido Flash");
    expect(markup).toContain('href="/admin/questions"');
    expect(markup).toContain('href="/admin/users"');
    expect(markup).toContain("Usuarios");
    expect(markup).not.toContain('href="/admin/seasons"');
    expect(markup).not.toContain('href="/admin/calendar"');
  });
});
