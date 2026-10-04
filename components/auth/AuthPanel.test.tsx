// @vitest-environment jsdom

import { Suspense, use, useEffect, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AuthenticationFailureCode,
  AuthenticationResult,
} from "@/types/contracts/authentication";
import { AuthPanel } from "./AuthPanel.client";

const { signIn, refresh } = vi.hoisted(() => ({
  signIn: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock("@/app/actions/authentication", () => ({
  signIn,
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function fillForm() {
  const email = screen.getByLabelText<HTMLInputElement>("Correo electrónico");
  const password = screen.getByLabelText<HTMLInputElement>("Contraseña");
  fireEvent.change(email, { target: { value: "player@example.com" } });
  fireEvent.change(password, { target: { value: "test-password" } });
  return { email, password, form: email.form! };
}

function RouterHarness({ response }: { response: Promise<boolean> }) {
  const [route, setRoute] = useState<Promise<boolean> | null>(null);
  useEffect(() => {
    refresh.mockImplementation(() => setRoute(response));
  }, [response]);
  const entered = route ? use(route) : false;
  return entered ? <h1>Mis salas</h1> : <AuthPanel />;
}

beforeEach(() => {
  vi.resetAllMocks();
  signIn.mockResolvedValue({ ok: true });
});

afterEach(cleanup);

describe("AuthPanel", () => {
  it("only exposes the private sign-in flow", () => {
    const markup = renderToStaticMarkup(<AuthPanel />);

    expect(markup).toContain("Entra a jugar");
    expect(markup).toContain("Iniciar sesión");
    expect(markup).toContain('id="auth-email"');
    expect(markup).toContain('id="auth-password"');
    expect(markup).not.toContain("Crea una cuenta");
    expect(markup).not.toContain("Crear cuenta");
    expect(markup).not.toContain("Nombre visible");
  });

  it("locks the form for the entire request and ignores simultaneous submissions", async () => {
    const request = deferred<AuthenticationResult>();
    signIn.mockReturnValue(request.promise);
    render(<AuthPanel />);
    const { email, password, form } = fillForm();

    act(() => {
      fireEvent.submit(form);
      fireEvent.submit(form);
    });

    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Iniciando sesión…"));
    expect(email.disabled).toBe(true);
    expect(password.disabled).toBe(true);
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: "Iniciando sesión…" }).disabled,
    ).toBe(true);
    expect(form.getAttribute("aria-busy")).toBe("true");
    expect(form.contains(screen.getByRole("status"))).toBe(false);
    expect(form.contains(screen.getByRole("alert"))).toBe(false);
    fireEvent.submit(form);
    expect(signIn).toHaveBeenCalledTimes(1);
    expect(signIn).toHaveBeenCalledWith({
      email: "player@example.com",
      password: "test-password",
    });

    await act(async () => request.resolve({ ok: false, code: "unexpected" }));
    await waitFor(() => expect(email.disabled).toBe(false));
    expect(password.disabled).toBe(false);
    expect(form.getAttribute("aria-busy")).toBe("false");
    expect(refresh).not.toHaveBeenCalled();
  });

  it.each([
    ["credentials", "Correo o contraseña incorrectos. Revisa tus datos.", true],
    ["rate_limit", "Demasiados intentos. Espera un momento y vuelve a intentarlo.", false],
    ["service", "El servicio no está disponible ahora. Inténtalo de nuevo.", false],
    ["connection", "No hemos podido conectar. Comprueba tu conexión y vuelve a intentarlo.", false],
    ["unexpected", "No se ha podido iniciar sesión. Inténtalo de nuevo.", false],
  ])("shows actionable feedback for %s", async (code, message, invalidCredentials) => {
    signIn.mockResolvedValue({ ok: false, code: code as AuthenticationFailureCode });
    render(<AuthPanel />);
    const { email, password, form } = fillForm();
    fireEvent.submit(form);

    await waitFor(() => {
      expect(email.disabled).toBe(false);
      expect(screen.getByRole("alert").textContent).toBe(message);
    });
    expect(screen.getByRole("status").textContent).toBe("");
    expect(email.value).toBe("player@example.com");
    expect(password.value).toBe("test-password");
    for (const field of [email, password]) {
      expect(field.getAttribute("aria-invalid")).toBe(invalidCredentials ? "true" : null);
      expect(field.getAttribute("aria-describedby")).toBe(invalidCredentials ? "auth-error" : null);
    }
    expect(screen.queryByText("private")).toBeNull();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("recovers from a rejected server action", async () => {
    signIn.mockRejectedValueOnce(new Error("private configuration"));
    render(<AuthPanel />);
    const { email, form } = fillForm();
    fireEvent.submit(form);
    await waitFor(() => {
      expect(email.disabled).toBe(false);
      expect(screen.getByRole("alert").textContent).toBe(
        "No se ha podido iniciar sesión. Inténtalo de nuevo.",
      );
    });

    fireEvent.submit(form);
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  });

  it("clears credential feedback when either field changes and when retrying", async () => {
    signIn.mockResolvedValue({ ok: false, code: "credentials" });
    render(<AuthPanel />);
    const { email, password, form } = fillForm();
    for (const field of [email, password]) {
      fireEvent.submit(form);
      await waitFor(() => {
        expect(email.disabled).toBe(false);
        expect(screen.getByRole("alert").textContent).toContain("incorrectos");
      });
      fireEvent.change(field, { target: { value: `${field.value}x` } });
      expect(screen.getByRole("alert").textContent).toBe("");
      expect(email.hasAttribute("aria-describedby")).toBe(false);
      expect(password.hasAttribute("aria-invalid")).toBe(false);
    }

    fireEvent.submit(form);
    await waitFor(() => expect(email.disabled).toBe(false));
    const request = deferred<AuthenticationResult>();
    signIn.mockReturnValueOnce(request.promise);
    fireEvent.submit(form);
    expect(screen.getByRole("alert").textContent).toBe("");
    await act(async () => request.resolve({ ok: false, code: "unexpected" }));
  });

  it("keeps the entry transition busy until the authenticated home replaces the login", async () => {
    const response = deferred<boolean>();
    render(
      <Suspense fallback={<p>Cargando portada</p>}>
        <RouterHarness response={response.promise} />
      </Suspense>,
    );
    const { email, password, form } = fillForm();
    fireEvent.submit(form);

    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Entrando…"));
    expect(email.disabled).toBe(true);
    expect(password.disabled).toBe(true);
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Entrando…" }).disabled).toBe(
      true,
    );
    expect(screen.queryByRole("button", { name: "Reintentar entrada" })).toBeNull();
    expect(screen.getByRole("alert").textContent).toBe("");
    fireEvent.submit(form);
    expect(signIn).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);

    await act(async () => response.resolve(true));
    expect(screen.getByRole("heading", { name: "Mis salas" })).toBeTruthy();
    expect(screen.queryByLabelText("Correo electrónico")).toBeNull();
  });

  it("retries only the refresh when the login remains after authentication", async () => {
    render(<AuthPanel />);
    fireEvent.submit(fillForm().form);
    const retry = await screen.findByRole("button", { name: "Reintentar entrada" });
    expect(screen.getByRole("alert").textContent).toBe(
      "No hemos podido abrir tu sesión. Reintenta la entrada.",
    );

    act(() => {
      fireEvent.click(retry);
      fireEvent.click(retry);
    });
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(2));
    expect(signIn).toHaveBeenCalledTimes(1);
    await waitFor(() => expect((retry as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(retry);
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(3));
  });
});
