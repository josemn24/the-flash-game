// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { AnswerResult, NarrativeScene } from "@/types/gameplay";
import {
  NarrativeEpilogueScreen,
  NarrativeResult,
  NarrativeSceneScreen,
  PolarBackground,
} from "./NarrativePresentation";
import styles from "./NarrativeGame.module.css";

afterEach(cleanup);
const scene: NarrativeScene = {
  id: "scene-prologue-recording",
  title: "Una grabación",
  eyebrow: "Archivo polar",
  media: {
    type: "image",
    src: "/images/narrative/prologue-recording.png",
    alt: "Grabadora en la nieve",
    fit: "contain",
    position: "30% 60%",
  },
  caption: "La señal sigue activa.",
  advanceLabel: "Escuchar",
  blocks: [
    { type: "narration", text: "La cinta empieza a girar." },
    { type: "dialogue", speaker: "Mara", text: "Hay alguien al otro lado." },
    { type: "emphasis", text: "No estamos solos." },
  ],
};

describe("shared narrative presentation", () => {
  it.each([
    ["standard", "storyPageSplit", false],
    ["chapter-opening", "storyPageChapter", true],
    ["full-bleed", "storyPageFullBleed", true],
    ["split", "storyPageSplit", false],
    ["text-led", "storyPageText", false],
    ["artifact", "storyPageArtifact", false],
    ["blackout", "storyPageText", false],
  ] satisfies [NonNullable<NarrativeScene["presentation"]>, string, boolean][])(
    "renders the %s presentation and keeps scene navigation",
    (presentation, className, dark) => {
      const onContinue = vi.fn();
      render(
        <NarrativeSceneScreen
          scene={{ ...scene, presentation }}
          pageNumber={2}
          pageCount={9}
          onContinue={onContinue}
        />,
      );
      const article = screen.getByRole("article");
      expect(article.parentElement?.classList.contains(styles[className])).toBe(true);
      expect(article.parentElement?.classList.contains(styles.storyPageDark)).toBe(dark);
      expect(screen.getByLabelText("Página 2 de 9").textContent).toBe("02 / 9");
      expect(within(article).getByRole("heading", { name: scene.title })).toBeTruthy();
      expect(within(article).getByText("Mara:").closest("p")?.textContent).toBe(
        "Mara: —Hay alguien al otro lado.",
      );
      expect(within(article).getByText("No estamos solos.").className).toBe(styles.sceneEmphasis);
      expect(within(article).getByText("La cinta empieza a girar.").className).toBe(
        styles.sceneParagraph,
      );
      fireEvent.click(screen.getByRole("button", { name: "Escuchar" }));
      expect(onContinue).toHaveBeenCalledOnce();
      expect(screen.queryByRole("timer")).toBeNull();
    },
  );

  it("preserves the prologue image, caption, sizing and recording signal", () => {
    const { rerender } = render(
      <NarrativeSceneScreen scene={scene} pageNumber={1} pageCount={3} onContinue={vi.fn()} />,
    );
    const image = screen.getByRole("img", { name: "Grabadora en la nieve" });
    expect(image.getAttribute("sizes")).toBe("(max-width: 799px) 100vw, 68vw");
    expect(image.className).toBe(styles.storyImageContain);
    expect(image.style.objectPosition).toBe("30% 60%");
    expect(image.getAttribute("loading")).toBeNull();
    expect(
      screen.getByLabelText("Siseo de una grabación antigua").querySelectorAll("i"),
    ).toHaveLength(12);
    expect(screen.getByText(scene.caption!)).toBeTruthy();
    rerender(
      <NarrativeSceneScreen
        scene={{
          ...scene,
          id: "later-scene",
          media: {
            ...scene.media!,
            type: "image",
            src: "/other.png",
            alt: "Otra escena",
            fit: "cover",
          },
        }}
        pageNumber={2}
        pageCount={3}
        onContinue={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText("Siseo de una grabación antigua")).toBeNull();
    expect(screen.getByRole("img").getAttribute("loading")).toBe("lazy");
    expect(screen.getByRole("img").className).toBe(styles.storyImage);
  });

  it("supports text without an image, title or blocks and defaults to Seguir", () => {
    render(
      <NarrativeSceneScreen
        scene={{ id: "empty", blocks: [] }}
        pageNumber={1}
        pageCount={1}
        onContinue={vi.fn()}
      />,
    );
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.queryByRole("heading")).toBeNull();
    expect(screen.getByRole("article").children).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Seguir" })).toBeTruthy();
  });

  it("renders the epilogue and continues to results", () => {
    const onContinue = vi.fn();
    render(<NarrativeEpilogueScreen onContinue={onContinue} />);
    expect(screen.getByRole("region", { name: "BUT WHY?" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ver resultado" }));
    expect(onContinue).toHaveBeenCalledOnce();
  });

  it("keeps the polar decoration outside the accessibility tree", () => {
    const { container } = render(<PolarBackground />);
    expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
    expect(container.firstElementChild?.children).toHaveLength(3);
  });

  const results: readonly AnswerResult[] = ["correct", "partial", "incorrect", "unanswered"].map(
    (status, index) => ({
      questionId: `q${index}`,
      answer: null,
      status:
        status === "correct"
          ? "correct"
          : status === "partial"
            ? "partial"
            : status === "incorrect"
              ? "incorrect"
              : "unanswered",
      isCorrect: status === "correct",
      points: index === 0 ? 50 : 0,
      timeUsed: 10,
    }),
  );
  it("uses the explicit maximum, readonly results, metrics and review navigation", () => {
    const onReview = vi.fn();
    render(
      <NarrativeResult
        results={results}
        score={50}
        maxScore={200}
        onReview={onReview}
        returnTo="/salas/polar"
      />,
    );
    expect(screen.getByLabelText("50 de 200 puntos")).toBeTruthy();
    expect(screen.getByText("40 s")).toBeTruthy();
    for (const label of ["Correctas", "Parciales", "Falladas", "Sin respuesta"]) {
      expect(screen.getByText(label).closest("div")?.parentElement?.textContent).toContain("1");
    }
    expect(screen.getByRole("link", { name: "Volver" }).getAttribute("href")).toBe("/salas/polar");
    fireEvent.click(screen.getByRole("button", { name: "Ver respuestas" }));
    expect(onReview).toHaveBeenCalledOnce();
    expect(screen.queryByText("Partida cerrada por inactividad")).toBeNull();
  });
  it("omits unavailable review and shows an expired attempt without awarded points", () => {
    render(<NarrativeResult results={results} score={50} maxScore={200} expired returnTo="/" />);
    expect(screen.getByRole("heading", { name: "Partida cerrada por inactividad" })).toBeTruthy();
    expect(screen.getByLabelText("0 de 200 puntos")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Ver respuestas" })).toBeNull();
  });
});
