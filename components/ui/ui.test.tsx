import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BellIcon, BoltIcon } from "@/components/ui";
import {
  AvatarStack,
  Button,
  ButtonLink,
  Card,
  Chip,
  GameHeader,
  IconButton,
  TimerDisplay,
} from ".";

describe("canonical UI primitives", () => {
  it("renders loading buttons as disabled and busy", () => {
    const markup = renderToStaticMarkup(<Button loading>Guardando</Button>);

    expect(markup).toContain("disabled");
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain("Guardando");
  });

  it("renders button links with their destination and trailing icon", () => {
    const markup = renderToStaticMarkup(
      <ButtonLink href="/flash-pop" trailingIcon={<BoltIcon />}>
        Abrir
      </ButtonLink>,
    );

    expect(markup).toContain('href="/flash-pop"');
    expect(markup).toContain("Abrir");
    expect(markup).toContain("<svg");
  });

  it("requires an accessible label for icon buttons", () => {
    const markup = renderToStaticMarkup(
      <IconButton label="Notificaciones">
        <BellIcon />
      </IconButton>,
    );

    expect(markup).toContain('aria-label="Notificaciones"');
    expect(markup).toContain('type="button"');
  });

  it("renders semantic chip variants", () => {
    const status = renderToStaticMarkup(<Chip tone="success">Completado</Chip>);
    const reward = renderToStaticMarkup(<Chip variant="reward">+120 ⚡</Chip>);

    expect(status).toContain("success");
    expect(reward).toContain("reward");
  });

  it("renders avatar fallback, overflow and associated text", () => {
    const markup = renderToStaticMarkup(
      <AvatarStack
        maxVisible={2}
        label="4 ya jugaron"
        items={[
          { id: "1", name: "Ana Moreno", tone: "coral" },
          { id: "2", name: "Luis Úbeda", tone: "blue" },
          { id: "3", name: "Rocío", tone: "aqua" },
          { id: "4", name: "Joel", tone: "ink" },
        ]}
      />,
    );

    expect(markup).toContain("AM");
    expect(markup).toContain("LÚ");
    expect(markup).toContain("+2");
    expect(markup).toContain("4 ya jugaron");
  });

  it("keeps card semantics and deterministic timer states", () => {
    const card = renderToStaticMarkup(<Card as="section">Contenido</Card>);
    const timer = renderToStaticMarkup(<TimerDisplay duration={20} remaining={4} />);

    expect(card).toContain("<section");
    expect(timer).toContain('role="timer"');
    expect(timer).toContain('data-state="urgent"');
    expect(timer).toContain('aria-label="4 segundos restantes"');
  });

  it("supports a mobile-only game progress label", () => {
    const markup = renderToStaticMarkup(
      <GameHeader title="Flash clásico" mobileLabel="Pregunta 04 de 16" />,
    );

    expect(markup).toContain("Pregunta 04 de 16");
    expect(markup).toContain("compactOnMobile");
  });
});
