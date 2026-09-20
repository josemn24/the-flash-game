import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AdminRoomsOverview } from "./AdminRoomsOverview";
import { CreateRoomForm } from "./CreateRoomForm.client";

describe("CreateRoomForm", () => {
  it("renders a create trigger without exposing the form before opening", () => {
    const markup = renderToStaticMarkup(<CreateRoomForm />);

    expect(markup).toContain("Crear nueva sala privada");
    expect(markup).toContain("<dialog");
    expect(markup).not.toContain('name="title"');
    expect(markup).not.toContain("Propietario inicial");
  });

  it("places the create action in the rooms overview when enabled", () => {
    const markup = renderToStaticMarkup(
      <AdminRoomsOverview rooms={[]} showAction />,
    );

    expect(markup).toContain("Crear nueva sala privada");
    expect(markup).not.toContain("Crear una sala privada");
  });
});
