import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminRoomsOverview } from "./AdminRoomsOverview";

describe("AdminRoomsOverview", () => {
  it("makes each active room card navigate to its detail", () => {
    const markup = renderToStaticMarkup(
      <AdminRoomsOverview
        rooms={[
          {
            roomId: "00000000-0000-4000-8000-000000000001",
            slug: "beta",
            title: "Sala beta",
            timeZone: "Europe/Madrid",
            status: "active",
            seasons: [],
          },
        ]}
      />,
    );

    expect(markup).toContain('href="/admin/rooms/00000000-0000-4000-8000-000000000001"');
    expect(markup).toContain("Ver detalle de Sala beta");
  });
});
