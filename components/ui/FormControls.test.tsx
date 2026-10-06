// @vitest-environment jsdom

import { createRef, useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FormField, Input, Select, Textarea } from ".";

afterEach(cleanup);

describe("shared form controls", () => {
  it("associates labels, simultaneous help/error and deduplicated external references", () => {
    const { rerender } = render(
      <>
        <p id="external">Aviso compartido</p>
        <FormField
          id="email"
          label="Correo"
          required
          density="compact"
          description="Ayuda"
          error="Error local"
          describedBy=" external  email-help external email-error "
        >
          {(field) => <Input {...field} type="email" name="email" />}
        </FormField>
      </>,
    );
    const input = screen.getByLabelText<HTMLInputElement>("Correo");
    expect(input.id).toBe("email");
    expect(input.required).toBe(true);
    expect(input.dataset.density).toBe("compact");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe("external email-help email-error");
    expect(document.getElementById("email-help")?.textContent).toBe("Ayuda");
    expect(document.getElementById("email-error")?.textContent).toBe("Error local");
    expect(screen.queryByRole("alert")).toBeNull();
    rerender(
      <FormField id="email" label="Correo" error="Error local" announceError>
        {(field) => <Input {...field} />}
      </FormField>,
    );
    expect(screen.getByRole("alert").id).toBe("email-error");
    rerender(
      <FormField id="email" label="Correo" invalid>
        {(field) => <Input {...field} />}
      </FormField>,
    );
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByLabelText("Correo").hasAttribute("aria-describedby")).toBe(false);
    rerender(
      <FormField id="email" label="Correo" error="" description={false}>
        {(field) => <Input {...field} />}
      </FormField>,
    );
    expect(screen.getByLabelText("Correo").hasAttribute("aria-invalid")).toBe(false);
    expect(document.getElementById("email-error")).toBeNull();
  });

  it("forwards refs, events, controlled values and native constraints for every control", () => {
    const inputRef = createRef<HTMLInputElement>();
    const selectRef = createRef<HTMLSelectElement>();
    const textareaRef = createRef<HTMLTextAreaElement>();
    const changed = vi.fn();
    function Example() {
      const [value, setValue] = useState("one");
      return (
        <>
          <FormField id="input" label="Nombre">
            {(field) => (
              <Input
                {...field}
                ref={inputRef}
                value={value}
                minLength={2}
                maxLength={24}
                autoComplete="name"
                readOnly
              />
            )}
          </FormField>
          <FormField id="select" label="Opción">
            {(field) => (
              <Select
                {...field}
                ref={selectRef}
                value={value}
                onChange={(event) => {
                  setValue(event.currentTarget.value);
                  changed(event.currentTarget.value);
                }}
              >
                <option value="one">Uno</option>
                <option value="two">Dos</option>
              </Select>
            )}
          </FormField>
          <FormField id="textarea" label="Documento">
            {(field) => (
              <Textarea
                {...field}
                ref={textareaRef}
                font="mono"
                rows={4}
                value={value}
                onChange={(event) => setValue(event.currentTarget.value)}
              />
            )}
          </FormField>
        </>
      );
    }
    render(<Example />);
    const input = screen.getByLabelText<HTMLInputElement>("Nombre");
    const select = screen.getByLabelText<HTMLSelectElement>("Opción");
    const textarea = screen.getByLabelText<HTMLTextAreaElement>("Documento");
    expect(inputRef.current).toBe(input);
    expect(selectRef.current).toBe(select);
    expect(textareaRef.current).toBe(textarea);
    inputRef.current?.focus();
    expect(document.activeElement).toBe(input);
    expect(input.minLength).toBe(2);
    expect(input.maxLength).toBe(24);
    expect(input.autocomplete).toBe("name");
    expect(input.readOnly).toBe(true);
    expect(textarea.rows).toBe(4);
    expect(textarea.dataset.font).toBe("mono");
    expect(input.dataset.density).toBe("comfortable");
    fireEvent.change(select, { target: { value: "two" } });
    expect(input.value).toBe("two");
    expect(textarea.value).toBe("two");
    expect(changed).toHaveBeenCalledWith("two");
    fireEvent.change(textarea, { target: { value: "edited" } });
    expect(input.value).toBe("edited");
  });

  it("preserves uncontrolled defaults, repeated values, hidden fields, disabled and native files", () => {
    const selected = vi.fn();
    const { container } = render(
      <form>
        <input type="hidden" name="key" value="retry-key" readOnly />
        <FormField id="first" label="Primer miembro">
          {(field) => <Input {...field} name="member" defaultValue="ana" />}
        </FormField>
        <FormField id="second" label="Segundo miembro">
          {(field) => <Input {...field} name="member" defaultValue="luis" />}
        </FormField>
        <FormField id="role" label="Rol">
          {(field) => (
            <Select {...field} name="role" defaultValue="member">
              <option value="member">Miembro</option>
            </Select>
          )}
        </FormField>
        <FormField id="notes" label="Notas">
          {(field) => <Textarea {...field} name="notes" defaultValue="initial" />}
        </FormField>
        <FormField id="disabled" label="Bloqueado">
          {(field) => <Input {...field} name="disabled" defaultValue="excluded" disabled />}
        </FormField>
        <FormField id="file" label="Archivo">
          {(field) => (
            <Input {...field} type="file" name="avatar" accept="image/png" onChange={selected} />
          )}
        </FormField>
      </form>,
    );
    fireEvent.change(screen.getByLabelText("Primer miembro"), { target: { value: "edited" } });
    const form = container.querySelector("form")!;
    const data = new FormData(form);
    expect(data.getAll("member")).toEqual(["edited", "luis"]);
    expect(data.get("key")).toBe("retry-key");
    expect(data.get("role")).toBe("member");
    expect(data.get("notes")).toBe("initial");
    expect(data.has("disabled")).toBe(false);
    const fileInput = screen.getByLabelText<HTMLInputElement>("Archivo");
    const file = new File(["image"], "avatar.png", { type: "image/png" });
    fireEvent.change(fileInput, { target: { files: [file] } });
    expect(fileInput.accept).toBe("image/png");
    expect(selected).toHaveBeenCalledOnce();
    expect(fileInput.files?.[0]).toBe(file);
    const ids = Array.from(container.querySelectorAll("[id]"), (e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
