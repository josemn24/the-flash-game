import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FlashPopRoomSettings } from "@/components/game/modes/flash-pop/FlashPopRoomSettings";
import { demoRoom } from "@/data/demoRoom";
import { buildRoomSettingsModel } from "@/lib/roomSettings";
import { dynamic, generateMetadata } from "./page";

describe("room settings route", () => {
  it("exposes Tabarnia and its settings view", async () => {
    expect(dynamic).toBe("force-dynamic");
    await expect(
      generateMetadata({ params: Promise.resolve({ roomId: "tabarnia-room" }) }),
    ).resolves.toMatchObject({
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
