// @vitest-environment jsdom
import Link from "next/link";
import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MeasurementProvider, ProductSignal, EnjoymentRating } from "./Measurement.client";
import { measurementId } from "@/test-utils/productMeasurement";
const send = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("@/features/product/transport", () => ({ sendProductEvent: send }));
const uuidV4Pattern = /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i;
function stubHttpUuidFallback() {
  let sequence = 0;
  const getRandomValues = vi.fn((bytes: Uint8Array) => bytes.fill(sequence++));
  vi.stubGlobal("crypto", { getRandomValues });
  return getRandomValues;
}
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});
describe("visible product signals", () => {
  it("generates event and visit UUIDs when randomUUID is unavailable on HTTP origins", () => {
    const getRandomValues = stubHttpUuidFallback();
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    render(
      <MeasurementProvider roomId="tabarnia">
        <ProductSignal type="room_viewed" />
      </MeasurementProvider>,
    );

    expect(send).toHaveBeenCalledOnce();
    expect(getRandomValues).toHaveBeenCalledTimes(2);
    const event = send.mock.calls[0][0];
    expect(event.eventId).toMatch(uuidV4Pattern);
    expect(event.visitId).toMatch(uuidV4Pattern);
    expect(event.eventId).not.toBe(event.visitId);
  });

  it("does not capture SSR/prefetch, hidden tabs or rerenders; captures once when visible", () => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    const tree = (
      <StrictMode>
        <MeasurementProvider roomId="tabarnia">
          <ProductSignal type="room_viewed" />
        </MeasurementProvider>
      </StrictMode>
    );
    const { rerender } = render(tree);
    expect(send).not.toHaveBeenCalled();
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    rerender(tree);
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(send).toHaveBeenCalledOnce();
  });
  it("does not capture demos and keeps rehearsal completion idempotent per execution", () => {
    render(<ProductSignal type="room_viewed" />);
    expect(send).not.toHaveBeenCalled();
    cleanup();
    const { rerender } = render(
      <MeasurementProvider
        roomId="tabarnia"
        publicationId={measurementId(3)}
        rehearsal
        runId={measurementId(4)}
      >
        <ProductSignal type="rehearsal_completed" />
      </MeasurementProvider>,
    );
    rerender(
      <MeasurementProvider
        roomId="tabarnia"
        publicationId={measurementId(3)}
        rehearsal
        runId={measurementId(4)}
      >
        <ProductSignal type="rehearsal_completed" />
      </MeasurementProvider>,
    );
    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0][0].visitId).toBe(measurementId(4));
  });
  it("keeps each rehearsal signal once across result remounts and allows a new execution", () => {
    const tree = (results: boolean, runId = measurementId(4)) => (
      <StrictMode>
        <MeasurementProvider
          roomId="tabarnia"
          publicationId={measurementId(3)}
          rehearsal
          runId={runId}
        >
          <ProductSignal type="rehearsal_started" />
          {results ? <ProductSignal type="rehearsal_completed" /> : <p>Revisión</p>}
        </MeasurementProvider>
      </StrictMode>
    );
    const { rerender } = render(tree(true));
    expect(send).toHaveBeenCalledTimes(2);
    const firstCompletion = send.mock.calls[1][0];
    rerender(tree(false));
    rerender(tree(true));
    rerender(tree(true));
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1][0]).toEqual(firstCompletion);
    rerender(tree(true, measurementId(5)));
    expect(send).toHaveBeenCalledTimes(4);
    expect(send.mock.calls[3][0].visitId).toBe(measurementId(5));
    expect(send.mock.calls[3][0].eventId).not.toBe(firstCompletion.eventId);
    rerender(tree(true));
    expect(send).toHaveBeenCalledTimes(4);
  });

  it("keeps navigation observations independent of the rehearsal registry", () => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    const tree = (visible: boolean) => (
      <MeasurementProvider roomId="tabarnia">
        {visible ? <ProductSignal type="room_viewed" /> : null}
      </MeasurementProvider>
    );
    const { rerender } = render(tree(true));
    rerender(tree(false));
    rerender(tree(true));
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0][0].visitId).not.toBe(send.mock.calls[1][0].visitId);
  });
});
describe("optional enjoyment", () => {
  it("creates a rating UUID when randomUUID is unavailable on HTTP origins", async () => {
    const getRandomValues = stubHttpUuidFallback();
    const seasonId = measurementId(80);
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ eligible: true, value: null, seasonId }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ eligible: true, value: 4, seasonId }),
      });
    vi.stubGlobal("fetch", fetcher);
    render(
      <MeasurementProvider
        roomId="tabarnia"
        publicationId={measurementId(3)}
        attemptId={measurementId(81)}
      >
        <EnjoymentRating />
      </MeasurementProvider>,
    );

    fireEvent.click(await screen.findByRole("radio", { name: "4 de 5 estrellas" }));
    await screen.findByText("Valoración guardada. Gracias.");
    const body = JSON.parse(fetcher.mock.calls[1][1].body);
    expect(getRandomValues).toHaveBeenCalledOnce();
    expect(body.id).toMatch(uuidV4Pattern);
  });

  it("loads the saved value and retries a failed change with the same id while navigation stays available", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ eligible: true, value: 2, seasonId: measurementId(80) }),
      })
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ eligible: true, value: 5, seasonId: measurementId(80) }),
      });
    vi.stubGlobal("fetch", fetcher);
    render(
      <MeasurementProvider
        roomId="tabarnia"
        publicationId={measurementId(3)}
        attemptId={measurementId(81)}
      >
        <EnjoymentRating />
        <Link href="/salas/tabarnia">Volver</Link>
      </MeasurementProvider>,
    );
    await waitFor(() =>
      expect(screen.getByRole("radio", { name: "2 de 5 estrellas", checked: true })).toBeTruthy(),
    );
    fireEvent.click(screen.getByRole("radio", { name: "5 de 5 estrellas: muchísimo" }));
    await screen.findByRole("button", { name: "Reintentar valoración" });
    expect(screen.getByRole("link", { name: "Volver" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar valoración" }));
    await screen.findByText("Valoración guardada. Gracias.");
    expect(fetcher.mock.calls[1][1].body).toBe(fetcher.mock.calls[2][1].body);
    expect(
      screen.getByRole("radio", { name: "5 de 5 estrellas: muchísimo", checked: true }),
    ).toBeTruthy();
  });

  it("preserves keyboard focus and prevents another selection while saving", async () => {
    const seasonId = measurementId(80);
    let finishSave!: (response: unknown) => void;
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ eligible: true, value: null, seasonId }),
      })
      .mockImplementationOnce(() => new Promise((resolve) => (finishSave = resolve)));
    vi.stubGlobal("fetch", fetcher);
    render(
      <MeasurementProvider
        roomId="tabarnia"
        publicationId={measurementId(3)}
        attemptId={measurementId(81)}
      >
        <EnjoymentRating />
        <Link href="/salas/tabarnia">Volver</Link>
      </MeasurementProvider>,
    );
    const four = await screen.findByRole("radio", { name: "4 de 5 estrellas" });
    four.focus();
    fireEvent.click(four);
    expect(screen.getByRole("group").getAttribute("aria-busy")).toBe("true");
    expect(four.getAttribute("aria-disabled")).toBe("true");
    expect(document.activeElement).toBe(four);
    expect(fireEvent.keyDown(four, { key: "ArrowRight" })).toBe(false);
    fireEvent.click(screen.getByRole("radio", { name: "5 de 5 estrellas: muchísimo" }));
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("link", { name: "Volver" })).toBeTruthy();

    await act(async () =>
      finishSave({ ok: true, json: async () => ({ eligible: true, value: 4, seasonId }) }),
    );
    expect(screen.getByRole("radio", { name: "4 de 5 estrellas", checked: true })).toBeTruthy();
    expect(document.activeElement).toBe(four);
  });

  it.each([null, 3])("respects closed eligibility with saved value %s", async (value) => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ eligible: false, value, seasonId: measurementId(80) }),
    });
    vi.stubGlobal("fetch", fetcher);
    render(
      <MeasurementProvider
        roomId="tabarnia"
        publicationId={measurementId(3)}
        attemptId={measurementId(81)}
      >
        <EnjoymentRating />
      </MeasurementProvider>,
    );
    await waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
    if (value === null) {
      expect(screen.queryByRole("region", { name: "Valoración del desafío" })).toBeNull();
    } else {
      const saved = await screen.findByRole("radio", { name: "3 de 5 estrellas", checked: true });
      expect(saved.closest("fieldset")?.disabled).toBe(true);
      expect(screen.queryByText("3 de 5 estrellas")).toBeNull();
    }
    expect(fetcher).toHaveBeenCalledOnce();
  });
});

it("saves the automatic season enjoyment with the fixed 1–5 scale", async () => {
  const seasonId = measurementId(80);
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ eligible: true, value: null, seasonId }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ eligible: true, value: 4, seasonId }),
    });
  vi.stubGlobal("fetch", fetcher);
  render(
    <MeasurementProvider
      roomId="tabarnia"
      publicationId={measurementId(3)}
      attemptId={measurementId(81)}
    >
      <EnjoymentRating />
    </MeasurementProvider>,
  );
  await screen.findByRole("group", { name: "¿Cuánto has disfrutado este desafío?" });
  expect(screen.getAllByRole("radio")).toHaveLength(5);
  expect(screen.queryByRole("radio", { checked: true })).toBeNull();
  expect(screen.queryByText("Sin valorar")).toBeNull();
  fireEvent.click(screen.getByRole("radio", { name: "4 de 5 estrellas" }));
  await screen.findByText("Valoración guardada. Gracias.");
  const body = JSON.parse(fetcher.mock.calls[1][1].body);
  expect(body).toMatchObject({ seasonId, value: 4 });
  expect(screen.getByRole("radio", { name: "4 de 5 estrellas", checked: true })).toBeTruthy();
  expect(screen.queryByText("4 de 5 estrellas")).toBeNull();
  expect(fetcher.mock.calls[0][0]).not.toContain("?all");
});
