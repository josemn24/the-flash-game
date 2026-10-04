// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuthenticationResult } from "@/types/contracts/authentication";
import { LogoutButton } from "./LogoutButton.client";

const { signOut } = vi.hoisted(() => ({ signOut: vi.fn() }));
vi.mock("@/app/actions/authentication", () => ({ signOut }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe("LogoutButton", () => {
  it("keeps logout pending until the server action settles and permits retrying failures", async () => {
    let resolve!: (result: AuthenticationResult) => void;
    signOut.mockReturnValueOnce(
      new Promise<AuthenticationResult>((done) => {
        resolve = done;
      }),
    );
    signOut.mockResolvedValue({ ok: false, code: "service" });
    render(<LogoutButton />);
    const button = screen.getByRole<HTMLButtonElement>("button", { name: "Salir" });
    fireEvent.click(button);
    expect(button.disabled).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");
    await act(async () => resolve({ ok: false, code: "service" }));
    await waitFor(() => expect(button.disabled).toBe(false));
    expect(screen.getByRole("status").textContent).toBe("No se ha podido cerrar la sesión.");
    fireEvent.click(button);
    await waitFor(() => expect(button.disabled).toBe(false));
    expect(signOut).toHaveBeenCalledTimes(2);
  });

  it("contains action exceptions without exposing internal details", async () => {
    signOut.mockRejectedValue(new Error("private provider error"));
    render(<LogoutButton />);
    fireEvent.click(screen.getByRole("button", { name: "Salir" }));
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe("No se ha podido cerrar la sesión."),
    );
    expect(screen.queryByText("private provider error")).toBeNull();
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Salir" }).disabled).toBe(false);
  });
});
