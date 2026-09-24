import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SuperadminUserCreation } from "./SuperadminUserCreation.client";

describe("SuperadminUserCreation", () => {
  it("renders direct confirmed-account fields without email invitation controls", () => {
    const markup = renderToStaticMarkup(<SuperadminUserCreation />);

    expect(markup).toContain("Crear usuario");
    expect(markup).toContain('name="email"');
    expect(markup).toContain('name="password"');
    expect(markup).toContain('name="displayName"');
    expect(markup).toContain('name="reason"');
    expect(markup).toContain("No se enviará por correo.");
    expect(markup).not.toContain("Invitar por correo");
    expect(markup).not.toContain("email_confirm");
  });
});
