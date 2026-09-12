import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FlashPopRoomSettings } from "@/components/game/modes/flash-pop/FlashPopRoomSettings";
import { demoRoom } from "@/data/demoRoom";
import { buildRoomSettingsModel } from "@/lib/roomSettings";
import { generateMetadata, generateStaticParams } from "./page";

describe("room settings route", () => {
  it("exposes Tabarnia and its settings view", async () => {
    expect(generateStaticParams()).toEqual([{ roomId: "tabarnia-room" }]);
    await expect(generateMetadata({ params: Promise.resolve({ roomId: "tabarnia-room" }) })).resolves.toMatchObject({
      title: "Ajustes de Tabarnia — Flash Pop",
    });

    const markup = renderToStaticMarkup(
      <FlashPopRoomSettings model={buildRoomSettingsModel(demoRoom)} />,
    );

    expect(markup).toContain("Acciones");
    expect(markup).toContain("Tabarnia");
    expect(markup).toContain('href="/salas/tabarnia-room"');
  });
});
