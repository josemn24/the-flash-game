import { describe, expect, it } from "vitest";
import ConceptsPage, { metadata } from "./page";

describe("Flash Pop concepts demo route", () => {
  it("renders the visual concepts surface", () => {
    const element = ConceptsPage();

    expect(element).toBeTruthy();
    expect(element.type).toBe("main");
    expect(metadata.title).toBe("The Flash — Arte de formatos");
  });
});
