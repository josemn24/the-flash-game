import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CalendarEntryCard } from "./CalendarEntryCard.client";
import { CalendarScheduleDialog } from "./CalendarScheduleDialog.client";

const room = {
  roomId: "00000000-0000-4000-8000-000000000002",
  slug: "sala-beta",
  title: "Sala beta",
  timeZone: "Europe/Madrid",
  status: "active" as const,
  seasons: [
    {
      seasonId: "00000000-0000-4000-8000-000000000003",
      title: "Temporada activa",
      status: "active" as const,
      startsAt: "2026-09-20T10:00:00.000Z",
      endsAt: "2026-10-20T10:00:00.000Z",
    },
  ],
};

const content = [
  {
    challengeDefinitionId: "00000000-0000-4000-8000-000000000007",
    challengeVersionId: "00000000-0000-4000-8000-000000000005",
    slug: "flash-beta",
    title: "Flash de prueba",
    subtitle: "Descripción",
    description: "Descripción del contenido",
    mode: "flash" as const,
    questionCount: 1,
    versionNumber: 1,
    status: "published" as const,
    createdAt: "2026-09-20T10:00:00.000Z",
    updatedAt: "2026-09-20T10:00:00.000Z",
    publishedAt: "2026-09-20T10:00:00.000Z",
    document: null,
  },
];

const entry = {
  scheduledChallengeId: "00000000-0000-4000-8000-000000000006",
  roomId: room.roomId,
  roomSlug: room.slug,
  roomTitle: room.title,
  timeZone: room.timeZone,
  seasonId: room.seasons[0].seasonId,
  seasonTitle: room.seasons[0].title,
  seasonStatus: "active" as const,
  challengeVersionId: content[0].challengeVersionId,
  challengeSlug: content[0].slug,
  versionNumber: content[0].versionNumber,
  challengeTitle: content[0].title,
  challengeSubtitle: "Descripción",
  mode: "flash" as const,
  number: 1,
  status: "scheduled" as const,
  opensAt: "2026-09-21T10:00:00.000Z",
  closesAt: "2026-09-21T11:00:00.000Z",
  updatedAt: "2026-09-20T10:00:00.000Z",
};

describe("CalendarScheduleDialog", () => {
  it("renders a create trigger without exposing the form before opening", () => {
    const markup = renderToStaticMarkup(
      <CalendarScheduleDialog
        mode="create"
        room={room}
        activeSeasons={room.seasons.map((season) => ({ room, season }))}
        publishedContent={content}
        nextNumber={() => 2}
      />,
    );

    expect(markup).toContain("Programar nuevo desafío");
    expect(markup).toContain("<dialog");
    expect(markup).not.toContain('name="seasonId"');
    expect(markup).not.toContain("Cancelar");
  });

  it("renders a reprogram trigger without an inline details form", () => {
    const markup = renderToStaticMarkup(
      <CalendarEntryCard
        entry={entry}
        room={room}
        content={content[0]}
        publishedContent={content}
        canEdit
      />,
    );

    expect(markup).toContain("Reprogramar");
    expect(markup).not.toContain("<details");
    expect(markup).not.toContain('name="expectedUpdatedAt"');
  });

  it("renders a compact weekly card without the full date range", () => {
    const markup = renderToStaticMarkup(
      <CalendarEntryCard
        entry={{
          ...entry,
          challengeTitle: "Un desafío con un título editorial suficientemente largo para truncarse",
        }}
        room={room}
        content={content[0]}
        publishedContent={content}
        canEdit={false}
        variant="week"
      />,
    );

    expect(markup).toContain("weekEntryTitle");
    expect(markup).toContain("12:00");
    expect(markup).toContain("13:00");
    expect(markup).toContain('href="/admin/challenges/00000000-0000-4000-8000-000000000007"');
    expect(markup).not.toContain("21 sept 2026");
    expect(markup).not.toContain("· v1");
  });
});
