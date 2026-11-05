import { describe, expect, it, vi } from "vitest";
import { ProductMeasurementUseCases } from "./product-measurement";
import type { ProductMeasurementGateway } from "@/application/ports/product-measurement";
import { measurementId, measurementDay } from "@/test-utils/productMeasurement";

function setup() {
  const gateway: ProductMeasurementGateway = {
    capture: vi.fn().mockResolvedValue(undefined),
    rating: vi.fn().mockResolvedValue({ eligible: false, value: null }),
    rate: vi.fn().mockResolvedValue({ eligible: true, value: 4, seasonId: measurementId(3) }),
  };
  return { gateway, useCases: new ProductMeasurementUseCases(gateway) };
}
const event = {
  eventId: measurementId(1),
  type: "room_viewed" as const,
  roomId: "room",
  visitId: measurementId(2),
  occurredAt: measurementDay(0),
  appVersion: "test",
};
const rating = {
  id: measurementId(1),
  publicationId: measurementId(2),
  attemptId: measurementId(4),
  seasonId: measurementId(3),
  value: 4,
};

describe("season product signals", () => {
  it("passes validated observations and season ratings to the authenticated gateway", async () => {
    const { gateway, useCases } = setup();
    await useCases.capture(event);
    await useCases.rating(rating.publicationId);
    await useCases.rate(rating);
    expect(gateway.capture).toHaveBeenCalledExactlyOnceWith(event);
    expect(gateway.rating).toHaveBeenCalledExactlyOnceWith(rating.publicationId);
    expect(gateway.rate).toHaveBeenCalledExactlyOnceWith(rating);
  });
  it("rejects injected identity and retired experiment selection", () => {
    const { gateway, useCases } = setup();
    expect(() =>
      useCases.capture({ ...event, playerId: measurementId(9) } as typeof event),
    ).toThrow("invalid_event");
    expect(() =>
      useCases.rate({ ...rating, experimentId: measurementId(9) } as typeof rating),
    ).toThrow("invalid_rating");
    expect(gateway.capture).not.toHaveBeenCalled();
    expect(gateway.rate).not.toHaveBeenCalled();
  });
  it.each([0, 6, 1.5, NaN])("rejects invalid enjoyment %s", (value) => {
    const { gateway, useCases } = setup();
    expect(() => useCases.rate({ ...rating, value })).toThrow("invalid_rating");
    expect(gateway.rate).not.toHaveBeenCalled();
  });
  it("requires valid season and publication identifiers", () => {
    const { useCases } = setup();
    expect(() => useCases.rate({ ...rating, seasonId: "" })).toThrow("invalid_rating");
    expect(() => useCases.rating("publication")).toThrow("invalid_publication");
  });
});
