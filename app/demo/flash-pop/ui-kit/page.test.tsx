import { describe, expect, it } from "vitest";
import UiKitPage, { metadata } from "./page";

describe("Flash Pop UI kit demo route", () => {
  it("renders the isolated UI kit surface", () => {
    const element = UiKitPage();

    expect(element).toBeTruthy();
    expect(metadata.title).toBe("The Flash — UI Kit");
  });
});
