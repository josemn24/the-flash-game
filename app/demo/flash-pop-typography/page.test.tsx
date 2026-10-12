import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => {
  const font = (options: { variable: string }) => ({ variable: options.variable });
  return {
    Bricolage_Grotesque: font,
    Fredoka: font,
    IBM_Plex_Mono: font,
    Manrope: font,
  };
});

import TypographyPage, { metadata } from "./page";

describe("Flash Pop typography demo route", () => {
  it("renders the typography comparison surface", () => {
    const element = TypographyPage();

    expect(element).toBeTruthy();
    expect(element.type).toBe("main");
    expect(metadata.title).toBe("The Flash — Bricolage vs Fredoka");
  });
});
