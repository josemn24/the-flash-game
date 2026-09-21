import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BellIcon, BoltIcon, CheckIcon, QueensCrownIcon } from "@/components/ui";
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
  it("keeps shared icons consistent and customizable", () => {
    const icon = renderToStaticMarkup(<CheckIcon className="h-4 w-4" />);
    const customIcon = renderToStaticMarkup(<QueensCrownIcon className="h-8 w-8" />);

    expect(icon).toContain("<svg");
    expect(icon).toContain('aria-hidden="true"');
    expect(icon).toContain("h-4 w-4");
    expect(icon).toContain('stroke-width="2"');
    expect(customIcon).toContain("<svg");
    expect(customIcon).toContain('class="h-8 w-8"');
  });

  it("renders loading buttons as disabled and busy", () => {
    const markup = renderToStaticMarkup(<Button loading>Guardando</Button>);

    expect(markup).toContain("disabled");
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain('data-variant="primary"');
    expect(markup).toContain('data-size="md"');
    expect(markup).toContain("Guardando");
  });

  it("normalizes the legacy hero size into the explicit appearance contract", () => {
    const markup = renderToStaticMarkup(<Button size="hero">Abrir</Button>);

    expect(markup).toContain('data-size="hero"');
    expect(markup).toContain('data-appearance="hero"');
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
    const defaultLongTimer = renderToStaticMarkup(<TimerDisplay duration={135} remaining={30} />);
    const ratioTimer = renderToStaticMarkup(
      <TimerDisplay duration={135} remaining={30} urgency={{ type: "ratio", value: 0.25 }} />,
    );

    expect(card).toContain("<section");
    expect(card).toContain('data-surface="surface"');
    expect(card).toContain('data-elevation="card"');
    expect(card).toContain('data-density="default"');
    expect(timer).toContain('role="timer"');
    expect(timer).toContain('data-state="urgent"');
    expect(timer).toContain('aria-label="4 segundos restantes"');
    expect(defaultLongTimer).toContain('data-state="normal"');
    expect(ratioTimer).toContain('data-state="urgent"');
  });

  it("supports a mobile-only game progress label", () => {
    const markup = renderToStaticMarkup(
      <GameHeader title="Flash clásico" mobileLabel="Pregunta 04 de 16" />,
    );

    expect(markup).toContain("Pregunta 04 de 16");
    expect(markup).toContain("compactOnMobile");
  });
});
