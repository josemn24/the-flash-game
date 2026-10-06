// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RoomMemberFields, RoomOwnerFields, type RoomMemberRow } from "./RoomMemberFields.client";

afterEach(cleanup);

describe("room member field composition", () => {
  it("gives rows visible labels and unique IDs while preserving repeated payload values", () => {
    const rows: RoomMemberRow[] = [
      {
        id: 1,
        email: "ana@example.com",
        role: "member",
        candidate: null,
        message: "No encontrado",
      },
      { id: 2, email: "luis@example.com", role: "admin", candidate: null, message: "" },
    ];
    const update = vi.fn(),
      lookup = vi.fn(),
      remove = vi.fn();
    const { container } = render(
      <form>
        <RoomMemberFields
          members={rows}
          pending={false}
          onAdd={vi.fn()}
          onUpdate={update}
          onLookup={lookup}
          onRemove={remove}
        />
        <RoomMemberFields
          members={rows}
          pending={false}
          onAdd={vi.fn()}
          onUpdate={vi.fn()}
          onLookup={vi.fn()}
          onRemove={vi.fn()}
        />
      </form>,
    );
    const emails = screen.getAllByLabelText<HTMLInputElement>("Email del miembro");
    const roles = screen.getAllByLabelText<HTMLSelectElement>("Rol del miembro");
    expect(screen.getAllByRole("group", { name: "Grupo inicial (opcional)" })).toHaveLength(2);
    expect(emails).toHaveLength(4);
    expect(roles).toHaveLength(4);
    expect(emails[0].getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(emails[0].getAttribute("aria-describedby")!)?.textContent).toBe(
      "No encontrado",
    );
    expect(container.querySelectorAll("label[for]")).toHaveLength(8);
    const ids = Array.from(container.querySelectorAll("[id]"), (e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    const data = new FormData(container.querySelector("form")!);
    expect(data.getAll("memberEmail")).toEqual([
      "ana@example.com",
      "luis@example.com",
      "ana@example.com",
      "luis@example.com",
    ]);
    expect(data.getAll("memberRole")).toEqual(["member", "admin", "member", "admin"]);
    fireEvent.change(emails[0], { target: { value: "new@example.com" } });
    expect(update).toHaveBeenCalledWith(1, {
      email: "new@example.com",
      candidate: null,
      message: "",
    });
    fireEvent.change(roles[0], { target: { value: "spectator" } });
    expect(update).toHaveBeenCalledWith(1, { role: "spectator" });
    fireEvent.click(screen.getAllByRole("button", { name: "Buscar" })[0]);
    expect(lookup).toHaveBeenCalledWith(rows[0]);
    fireEvent.click(screen.getAllByRole("button", { name: "Quitar" })[0]);
    expect(remove).toHaveBeenCalledWith(1);
  });

  it("associates owner lookup feedback without changing its email or callbacks", () => {
    const change = vi.fn(),
      lookup = vi.fn();
    render(
      <form>
        <RoomOwnerFields
          email="owner@example.com"
          candidate={null}
          error="Revisa el propietario"
          message=""
          pending={false}
          onEmailChange={change}
          onLookup={lookup}
        />
      </form>,
    );
    const input = screen.getByLabelText<HTMLInputElement>("Correo del propietario");
    expect(input.required).toBe(true);
    expect(input.name).toBe("ownerEmail");
    expect(new FormData(input.form!).get("ownerEmail")).toBe("owner@example.com");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(input.getAttribute("aria-describedby")!)?.textContent).toBe(
      "Revisa el propietario",
    );
    fireEvent.change(input, { target: { value: "changed@example.com" } });
    expect(change).toHaveBeenCalledWith("changed@example.com");
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    expect(lookup).toHaveBeenCalledOnce();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
