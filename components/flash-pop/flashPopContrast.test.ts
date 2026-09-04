import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const theme = readFileSync(new URL("./FlashPopTheme.module.css", import.meta.url), "utf8");

function token(name: string) {
  const match = theme.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!match) throw new Error(`Missing hex token --${name}`);
  return match[1];
}

function luminance(hex: string) {
  const channels = hex
    .slice(1)
    .match(/../g)!
    .map((part) => Number.parseInt(part, 16) / 255)
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(foreground: string, background: string) {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe("Flash Pop token contrast", () => {
  it.each([
    ["ink on brand", "pop-color-ink", "pop-color-brand"],
    ["ink on surface", "pop-color-ink", "pop-color-surface"],
    ["muted on canvas", "pop-color-ink-muted", "pop-color-canvas"],
    ["muted on surface", "pop-color-ink-muted", "pop-color-surface"],
    ["focus on surface", "pop-color-focus", "pop-color-surface"],
    ["surface on social", "pop-color-surface", "pop-color-social"],
    ["ink on reward", "pop-color-ink", "pop-color-reward"],
    ["ink on success", "pop-color-ink", "pop-color-success"],
    ["ink on danger", "pop-color-ink", "pop-color-danger"],
    ["ink on info", "pop-color-ink", "pop-color-info"],
  ])("keeps %s at WCAG AA for normal text", (_label, foreground, background) => {
    expect(contrast(token(foreground), token(background))).toBeGreaterThanOrEqual(4.5);
  });
});
