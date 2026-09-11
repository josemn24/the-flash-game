import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FlashPopHome } from "@/components/game/modes/flash-pop/FlashPopHome.client";
import type { RoomCardModel } from "@/types/game";
import type { UserProfile } from "@/types/user";

const tabarnia: RoomCardModel = {
  roomId: "tabarnia-room",
  title: "Tabarnia",
  seasonTitle: "Primera temporada",
  seasonStatus: "active",
  dailyChallenge: {
    id: "tabarnia-flash-01",
    title: "Steel Ball Run",
    formatLabel: "Flash",
    subtitle: "Carrera, ingenio y reflejos",
    availableUntil: "2026-09-20T21:59:59.999Z",
    questionCount: 16,
    imageSrc: "/flash-pop/concepts/pyramid-soft-diorama.webp",
  },
  currentUser: { totalPoints: 136, roomRank: 3 },
  memberPreviews: [
    { id: "player", name: "Kike", initials: "KI" },
    { id: "ches", name: "Dark", initials: "DA" },
    { id: "marta", name: "Jackobo", initials: "JA" },
    { id: "alex", name: "Rielbe", initials: "RI" },
  ],
  memberCount: 5,
  href: "/salas/tabarnia-room",
};

const profile: UserProfile = {
  id: "player",
  name: "Kike",
  avatarSrc: "/flash-pop/avatars/player.jpeg",
};

describe("FlashPopHome", () => {
  it("renders the room selector with the daily challenge and room ranking", () => {
    const markup = renderToStaticMarkup(
      <FlashPopHome rooms={[tabarnia]} initialProfile={profile} />,
    );

    expect(markup).toContain("Mis salas");
    expect(markup).toContain("Tabarnia");
    expect(markup).toContain("Steel Ball Run");
    expect(markup).toContain("136");
    expect(markup).toContain("#3");
    expect(markup).toContain('aria-label="5 jugadores"');
    expect(markup).toContain('href="/salas/tabarnia-room"');
    expect(markup).toContain('aria-label="Perfil"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain('aria-haspopup="dialog"');
    expect(markup).toContain('aria-controls="flash-pop-profile-dialog"');
    expect(markup).toContain('aria-label="Configuración"');
    expect(markup).toContain("Tu perfil");
    expect(markup).toContain("Nombre visible");
    expect(markup).toContain("Cambiar imagen");
    expect(markup).toContain('accept="image/*"');
    expect(markup).toContain('aria-label="Kike"');
  });

  it("does not render the previous editorial hierarchy", () => {
    const markup = renderToStaticMarkup(
      <FlashPopHome rooms={[tabarnia]} initialProfile={profile} />,
    );

    expect(markup).not.toContain("Tus salas.");
    expect(markup).not.toContain("Elige dónde jugar hoy.");
    expect(markup).not.toContain("Elige dónde jugar");
    expect(markup).not.toContain("1 sala");
    expect(markup).not.toContain("Primera temporada");
    expect(markup).not.toContain("En directo");
  });

  it("renders one card for each room", () => {
    const secondRoom = { ...tabarnia, roomId: "second-room", title: "Cousin Club" };
    const markup = renderToStaticMarkup(
      <FlashPopHome rooms={[tabarnia, secondRoom]} initialProfile={profile} />,
    );

    expect(markup.match(/class="[^"]*roomCard/g)).toHaveLength(2);
    expect(markup).toContain("Cousin Club");
  });

  it("keeps a room visible when it has no daily challenge", () => {
    const roomWithoutChallenge = { ...tabarnia, dailyChallenge: null };
    const markup = renderToStaticMarkup(
      <FlashPopHome rooms={[roomWithoutChallenge]} initialProfile={profile} />,
    );

    expect(markup).toContain("Sin reto hoy");
    expect(markup).toContain('href="/salas/tabarnia-room"');
    expect(markup).toContain('aria-label="Abrir sala Tabarnia. Sin reto hoy"');
  });

  it("renders an empty state when the user has no rooms", () => {
    const markup = renderToStaticMarkup(<FlashPopHome rooms={[]} initialProfile={profile} />);

    expect(markup).toContain("No tienes salas.");
    expect(markup).toContain("Cuando te unas a una sala, aparecerá aquí.");
  });
});
