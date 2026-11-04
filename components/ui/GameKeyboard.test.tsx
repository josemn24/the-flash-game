// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { GameKeyboard } from "./GameKeyboard";

afterEach(cleanup);

it("shares the Spanish layout, optionally includes space and preserves editor focus", () => {
  const onKeyPress = vi.fn();
  const onPreserveFocus = vi.fn();
  const view = render(
    <GameKeyboard
      disabled={false}
      includeSpace
      onKeyPress={onKeyPress}
      onPreserveFocus={onPreserveFocus}
    />,
  );
  const keyboard = within(screen.getByRole("group", { name: "Teclado del juego" }));
  for (const name of ["Ñ", "Espacio", "Borrar último carácter"]) {
    const key = keyboard.getByRole("button", { name });
    fireEvent.pointerDown(key);
    fireEvent.click(key);
  }
  expect(onKeyPress.mock.calls.flat()).toEqual(["Ñ", " ", "Backspace"]);
  expect(onPreserveFocus).toHaveBeenCalledTimes(3);
  view.rerender(
    <GameKeyboard disabled compact onKeyPress={onKeyPress} onPreserveFocus={onPreserveFocus} />,
  );
  expect(keyboard.queryByRole("button", { name: "Espacio" })).toBeNull();
  fireEvent.click(keyboard.getByRole("button", { name: "A" }));
  expect(onKeyPress).toHaveBeenCalledTimes(3);
});
