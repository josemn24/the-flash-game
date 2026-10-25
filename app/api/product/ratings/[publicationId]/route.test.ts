import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProductMeasurementUseCases } from "@/application/use-cases/product-measurement";
import { measurementId } from "@/test-utils/productMeasurement";
const gateway = vi.hoisted(() => ({ capture: vi.fn(), rating: vi.fn(), rate: vi.fn() }));
vi.mock("@/server/product/measurement", () => ({
  productMeasurement: new ProductMeasurementUseCases(gateway),
}));
import { GET, PUT } from "./route";
const context = { params: Promise.resolve({ publicationId: measurementId(2) }) };
const url = `http://127.0.0.1:3000/api/product/ratings/${measurementId(2)}`;
const body = { id: measurementId(1), seasonId: measurementId(3), value: 4 };
const request = (value: unknown) =>
  new Request(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
beforeEach(() => vi.resetAllMocks());

describe("season enjoyment API", () => {
  it("returns one non-cacheable rating", async () => {
    const rating = { eligible: true, value: 4, seasonId: body.seasonId };
    gateway.rating.mockResolvedValue(rating);
    const response = await GET(new Request(url), context);
    expect(await response.json()).toEqual(rating);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(gateway.rating).toHaveBeenCalledWith(measurementId(2));
  });
  it("writes a validated season rating", async () => {
    gateway.rate.mockResolvedValue({ eligible: true, value: 4, seasonId: body.seasonId });
    expect((await PUT(request(body), context)).status).toBe(200);
    expect(gateway.rate).toHaveBeenCalledExactlyOnceWith({
      ...body,
      publicationId: measurementId(2),
    });
  });
  it.each([
    { ...body, experimentId: measurementId(9) },
    { ...body, seasonId: undefined },
    { ...body, value: 6 },
    { ...body, value: 1.5 },
  ])("rejects obsolete or invalid input", async (input) => {
    expect((await PUT(request(input), context)).status).toBe(400);
    expect(gateway.rate).not.toHaveBeenCalled();
  });
  it("denies a foreign origin before accessing persistence", async () => {
    const foreign = request(body);
    foreign.headers.set("origin", "https://foreign.example");
    expect((await PUT(foreign, context)).status).toBe(403);
    expect(gateway.rate).not.toHaveBeenCalled();
  });
});
