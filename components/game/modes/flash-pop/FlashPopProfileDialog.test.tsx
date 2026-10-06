// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProfileSaveResult } from "@/types/view-models/user-actions";
import { FlashPopProfileDialog } from "./FlashPopProfileDialog.client";

const profile = { id: "player", name: "Ana" };
beforeEach(() => {
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.open = true;
      },
    },
    close: {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.open = false;
      },
    },
  });
});
afterEach(() => {
  cleanup();
  Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
  Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
  vi.restoreAllMocks();
});

describe("profile form", () => {
  it("keeps name focus, validation, pending state, trimmed payload and error recovery", async () => {
    let resolve!: (value: ProfileSaveResult) => void;
    const save = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<ProfileSaveResult>((r) => {
            resolve = r;
          }),
      )
      .mockResolvedValue({ ok: true, profile });
    render(<FlashPopProfileDialog open profile={profile} onClose={vi.fn()} onSave={save} />);
    const name = screen.getByLabelText<HTMLInputElement>("Nombre visible");
    const file = screen.getByLabelText<HTMLInputElement>("Imagen de perfil");
    expect(document.activeElement).toBe(name);
    expect(name.minLength).toBe(2);
    expect(name.maxLength).toBe(24);
    expect(name.autocomplete).toBe("name");
    expect(file.accept).toBe("image/jpeg,image/png,image/webp");
    fireEvent.change(name, { target: { value: "a" } });
    fireEvent.submit(name.form!);
    expect(save).not.toHaveBeenCalled();
    expect(name.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole("alert").id).toBe(name.id + "-error");
    expect(document.activeElement).toBe(name);
    fireEvent.change(name, { target: { value: "  Ana nueva  " } });
    expect(name.hasAttribute("aria-invalid")).toBe(false);
    fireEvent.submit(name.form!);
    expect(name.form!.getAttribute("aria-busy")).toBe("true");
    expect(file.disabled).toBe(true);
    expect(save).toHaveBeenCalledWith({ name: "Ana nueva", file: null });
    await act(async () =>
      resolve({ ok: false, code: "save_failed", message: "Reintenta el guardado" }),
    );
    expect(screen.getByRole("alert").textContent).toBe("Reintenta el guardado");
    expect(file.disabled).toBe(false);
    fireEvent.submit(name.form!);
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(save).toHaveBeenLastCalledWith({ name: "Ana nueva", file: null });
  });

  it("associates native file help/error and preserves valid selection on submit", async () => {
    const save = vi.fn().mockResolvedValue({ ok: true, profile });
    const create = vi.fn().mockReturnValue("blob:preview");
    const revoke = vi.fn();
    vi.stubGlobal(
      "URL",
      class extends URL {
        static createObjectURL = create;
        static revokeObjectURL = revoke;
      },
    );
    try {
      render(<FlashPopProfileDialog open profile={profile} onClose={vi.fn()} onSave={save} />);
      const file = screen.getByLabelText<HTMLInputElement>("Imagen de perfil");
      const invalid = new File(["x"], "bad.txt", { type: "text/plain" });
      fireEvent.change(file, { target: { files: [invalid] } });
      expect(file.getAttribute("aria-invalid")).toBe("true");
      expect(file.getAttribute("aria-describedby")).toBe(file.id + "-help " + file.id + "-error");
      expect(screen.queryByRole("alert")).toBeNull();
      const valid = new File(["image"], "avatar.png", { type: "image/png" });
      fireEvent.change(file, { target: { files: [valid] } });
      expect(file.hasAttribute("aria-invalid")).toBe(false);
      expect(create).toHaveBeenCalledWith(valid);
      fireEvent.submit(file.form!);
      await waitFor(() => expect(save).toHaveBeenCalledWith({ name: "Ana", file: valid }));
      fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
      expect(revoke).toHaveBeenCalledWith("blob:preview");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
