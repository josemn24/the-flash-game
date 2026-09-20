import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminNavigation } from "./AdminNavigation";

describe("AdminNavigation", () => {
  it("exposes every canonical section and marks the active route", () => {
    const markup = renderToStaticMarkup(<AdminNavigation activeSection="content" />);

    expect(markup).toContain('href="/admin"');
    expect(markup).toContain('href="/admin/rooms"');
    expect(markup).toContain('aria-current="page" data-active="true" href="/admin/content"');
    expect(markup).toContain('href="/admin/questions"');
    expect(markup).not.toContain('href="/admin/seasons"');
    expect(markup).not.toContain('href="/admin/calendar"');
  });
});
